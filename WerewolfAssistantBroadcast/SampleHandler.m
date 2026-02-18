#import "SampleHandler.h"
#import <AVFoundation/AVFoundation.h>
#import <Vision/Vision.h>

@interface SampleHandler ()

@property (nonatomic, strong) AVAssetWriter *writer;
@property (nonatomic, strong) AVAssetWriterInput *videoInput;
@property (nonatomic, strong) AVAssetWriterInput *audioInput;
@property (nonatomic, assign) BOOL sessionStarted;
@property (nonatomic, strong) NSURL *outputURL;
@property (nonatomic, assign) BOOL didLogVideoAppendFailure;
@property (nonatomic, assign) BOOL didLogAudioAppendFailure;
@property (nonatomic, assign) BOOL ocrInFlight;
@property (nonatomic, assign) NSTimeInterval lastOCRTime;
@property (nonatomic, assign) NSTimeInterval broadcastStartTime;
@property (nonatomic, assign) BOOL didLogLiveOCREnabled;
@property (nonatomic, assign) CGRect speakerROI;

@end

@implementation SampleHandler

- (void)broadcastStartedWithSetupInfo:(NSDictionary<NSString *,NSObject *> *)setupInfo {
    self.sessionStarted = NO;
    self.didLogVideoAppendFailure = NO;
    self.didLogAudioAppendFailure = NO;
    self.ocrInFlight = NO;
    self.lastOCRTime = 0;
    self.broadcastStartTime = [[NSDate date] timeIntervalSince1970];
    self.didLogLiveOCREnabled = NO;
    self.speakerROI = CGRectMake(0.20, 0.60, 0.60, 0.08);
    self.outputURL = [self newOutputURL];
    [self setupWriterWithURL:self.outputURL];
    [self appendLog:[NSString stringWithFormat:@"broadcastStarted url=%@", self.outputURL.path]];
}

- (void)broadcastPaused {
}

- (void)broadcastResumed {
}

- (void)broadcastFinished {
    if (self.writer == nil) {
        return;
    }
    [self appendLog:@"broadcastFinished"];
    [self.videoInput markAsFinished];
    [self.audioInput markAsFinished];
    [self.writer finishWritingWithCompletionHandler:^{
        [self appendLog:[NSString stringWithFormat:@"finishWriting status=%ld error=%@", (long)self.writer.status, self.writer.error]];
        self.writer = nil;
    }];
}

- (void)processSampleBuffer:(CMSampleBufferRef)sampleBuffer withType:(RPSampleBufferType)sampleBufferType {
    if (!CMSampleBufferIsValid(sampleBuffer)) {
        return;
    }
    if (self.writer == nil) {
        return;
    }

    if (!self.sessionStarted) {
        CMTime startTime = CMSampleBufferGetPresentationTimeStamp(sampleBuffer);
        [self.writer startWriting];
        [self.writer startSessionAtSourceTime:startTime];
        self.sessionStarted = YES;
        [self appendLog:@"writer start session"];
    }

    if (sampleBufferType == RPSampleBufferTypeVideo) {
        if (self.videoInput.isReadyForMoreMediaData) {
            BOOL ok = [self.videoInput appendSampleBuffer:sampleBuffer];
            if (!ok && !self.didLogVideoAppendFailure) {
                self.didLogVideoAppendFailure = YES;
                [self appendLog:[NSString stringWithFormat:@"append video failed status=%ld error=%@", (long)self.writer.status, self.writer.error]];
            }
        }
        [self maybeRunSpeakerDetectionWithSampleBuffer:sampleBuffer];
    } else if (sampleBufferType == RPSampleBufferTypeAudioApp) {
        return;
    } else if (sampleBufferType == RPSampleBufferTypeAudioMic) {
        if (self.audioInput.isReadyForMoreMediaData) {
            BOOL ok = [self.audioInput appendSampleBuffer:sampleBuffer];
            if (!ok && !self.didLogAudioAppendFailure) {
                self.didLogAudioAppendFailure = YES;
                [self appendLog:[NSString stringWithFormat:@"append audio failed status=%ld error=%@", (long)self.writer.status, self.writer.error]];
            }
        }
    }
}

- (void)setupWriterWithURL:(NSURL *)url {
    NSError *error = nil;
    self.writer = [[AVAssetWriter alloc] initWithURL:url fileType:AVFileTypeMPEG4 error:&error];
    if (error != nil) {
        [self appendLog:[NSString stringWithFormat:@"writer init error=%@", error]];
        return;
    }

    NSDictionary *videoSettings = @{
        AVVideoCodecKey: AVVideoCodecTypeH264,
        AVVideoWidthKey: @1280,
        AVVideoHeightKey: @720
    };
    self.videoInput = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:videoSettings];
    self.videoInput.expectsMediaDataInRealTime = YES;

    AudioChannelLayout channelLayout;
    memset(&channelLayout, 0, sizeof(AudioChannelLayout));
    channelLayout.mChannelLayoutTag = kAudioChannelLayoutTag_Stereo;

    NSDictionary *audioSettings = @{
        AVFormatIDKey: @(kAudioFormatMPEG4AAC),
        AVNumberOfChannelsKey: @2,
        AVSampleRateKey: @44100,
        AVChannelLayoutKey: [NSData dataWithBytes:&channelLayout length:sizeof(AudioChannelLayout)],
        AVEncoderBitRateKey: @128000
    };
    self.audioInput = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeAudio outputSettings:audioSettings];
    self.audioInput.expectsMediaDataInRealTime = YES;

    if ([self.writer canAddInput:self.videoInput]) {
        [self.writer addInput:self.videoInput];
    }
    if ([self.writer canAddInput:self.audioInput]) {
        [self.writer addInput:self.audioInput];
    }
}

- (NSURL *)newOutputURL {
    NSURL *container = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.code.WerewolfAssistant"];
    if (container == nil) {
        container = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask] firstObject];
    }
    NSURL *captures = [container URLByAppendingPathComponent:@"captures" isDirectory:YES];
    if (![[NSFileManager defaultManager] fileExistsAtPath:captures.path]) {
        [[NSFileManager defaultManager] createDirectoryAtURL:captures withIntermediateDirectories:YES attributes:nil error:nil];
    }

    NSString *name = [NSString stringWithFormat:@"capture_%@.mp4", [[NSUUID UUID] UUIDString]];
    return [captures URLByAppendingPathComponent:name];
}

- (void)maybeRunSpeakerDetectionWithSampleBuffer:(CMSampleBufferRef)sampleBuffer {
    NSTimeInterval now = [[NSDate date] timeIntervalSince1970];
    if (self.ocrInFlight || (now - self.lastOCRTime) < 2.0) {
        return;
    }
    if ((now - self.broadcastStartTime) < 10.0) {
        return;
    }
    BOOL enabled = [self isLiveOCREnabled];
    if (!enabled) {
        if (!self.didLogLiveOCREnabled) {
            self.didLogLiveOCREnabled = YES;
            [self appendLog:@"live OCR disabled"];
        }
        return;
    }
    self.ocrInFlight = YES;
    self.lastOCRTime = now;

    CVPixelBufferRef pixelBuffer = CMSampleBufferGetImageBuffer(sampleBuffer);
    if (pixelBuffer == nil) {
        self.ocrInFlight = NO;
        return;
    }

    // 先做一次极轻量的亮度检测，避免无意义 OCR 触发扩展负载
    if (![self quickBrightnessGate:pixelBuffer roi:self.speakerROI]) {
        self.ocrInFlight = NO;
        return;
    }

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_UTILITY, 0), ^{
        @autoreleasepool {
            [self runSpeakerOCRWithPixelBuffer:pixelBuffer];
            self.ocrInFlight = NO;
        }
    });
}

- (BOOL)quickBrightnessGate:(CVPixelBufferRef)pixelBuffer roi:(CGRect)roi {
    CVPixelBufferLockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
    size_t width = CVPixelBufferGetWidth(pixelBuffer);
    size_t height = CVPixelBufferGetHeight(pixelBuffer);
    size_t bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer);
    uint8_t *base = CVPixelBufferGetBaseAddress(pixelBuffer);
    if (base == NULL || width == 0 || height == 0) {
        CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
        return NO;
    }

    size_t x0 = (size_t)(roi.origin.x * width);
    size_t y0 = (size_t)(roi.origin.y * height);
    size_t w = (size_t)(roi.size.width * width);
    size_t h = (size_t)(roi.size.height * height);
    if (x0 + w > width) { w = width - x0; }
    if (y0 + h > height) { h = height - y0; }
    if (w == 0 || h == 0) {
        CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
        return NO;
    }

    double sum = 0.0;
    int samples = 0;
    int stepX = (int)MAX(1, w / 10);
    int stepY = (int)MAX(1, h / 6);
    for (size_t y = y0; y < y0 + h; y += stepY) {
        uint8_t *row = base + y * bytesPerRow;
        for (size_t x = x0; x < x0 + w; x += stepX) {
            uint8_t *px = row + x * 4;
            double b = px[0];
            double g = px[1];
            double r = px[2];
            double yv = 0.114 * b + 0.587 * g + 0.299 * r;
            sum += yv;
            samples += 1;
        }
    }
    CVPixelBufferUnlockBaseAddress(pixelBuffer, kCVPixelBufferLock_ReadOnly);
    double avg = samples > 0 ? (sum / samples) : 0.0;
    return avg > 70.0;
}

- (void)runSpeakerOCRWithPixelBuffer:(CVPixelBufferRef)pixelBuffer {
    VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull req, NSError * _Nullable error) {
        if (error != nil) {
            return;
        }
        NSMutableArray<NSString *> *lines = [[NSMutableArray alloc] init];
        for (VNRecognizedTextObservation *ob in req.results) {
            VNRecognizedText *top = [[ob topCandidates:1] firstObject];
            if (top.string.length > 0) {
                [lines addObject:top.string];
            }
        }
        NSString *joined = [lines componentsJoinedByString:@" "];
        NSString *speaker = [self extractSpeakerFromOCRText:joined];
        if (speaker.length > 0) {
            [self writeLiveOCRWithSpeaker:speaker text:@""];
        }
    }];
    request.recognitionLevel = VNRequestTextRecognitionLevelFast;
    request.usesLanguageCorrection = NO;
    request.recognitionLanguages = @[@"zh-Hans", @"en-US"];
    request.regionOfInterest = self.speakerROI;

    VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCVPixelBuffer:pixelBuffer options:@{}];
    NSError *err = nil;
    [handler performRequests:@[request] error:&err];
}

- (NSString *)extractSpeakerFromOCRText:(NSString *)text {
    if (text.length == 0) {
        return @"";
    }
    NSRegularExpression *regex = [NSRegularExpression regularExpressionWithPattern:@"(\\d{1,2})\\s*号" options:0 error:nil];
    NSTextCheckingResult *match = [regex firstMatchInString:text options:0 range:NSMakeRange(0, text.length)];
    if (match != nil && match.numberOfRanges > 1) {
        NSString *num = [text substringWithRange:[match rangeAtIndex:1]];
        return [NSString stringWithFormat:@"%@号发言", num];
    }
    if ([text containsString:@"发言"]) {
        return @"发言中";
    }
    return @"";
}

- (BOOL)isLiveOCREnabled {
    NSURL *container = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.code.WerewolfAssistant"];
    if (container == nil) {
        return NO;
    }
    NSURL *fileURL = [container URLByAppendingPathComponent:@"live_ocr_enabled.json"];
    NSData *data = [NSData dataWithContentsOfURL:fileURL];
    if (data == nil) {
        return NO;
    }
    id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![json isKindOfClass:[NSDictionary class]]) {
        return NO;
    }
    return [json[@"enabled"] boolValue];
}

- (void)writeLiveOCRWithSpeaker:(NSString *)speaker text:(NSString *)text {
    NSURL *container = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.code.WerewolfAssistant"];
    if (container == nil) {
        return;
    }
    NSURL *fileURL = [container URLByAppendingPathComponent:@"live_ocr.json"];
    NSDictionary *payload = @{
        @"timestamp": @([[NSDate date] timeIntervalSince1970]),
        @"speaker": speaker ?: @"",
        @"text": text ?: @""
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
    if (data != nil) {
        [data writeToURL:fileURL atomically:YES];
    }
}

- (void)appendLog:(NSString *)message {
    NSURL *container = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.code.WerewolfAssistant"];
    if (container == nil) {
        return;
    }
    NSURL *logURL = [container URLByAppendingPathComponent:@"broadcast.log"];
    NSString *line = [NSString stringWithFormat:@"%@ %@\n", [NSDate date], message];
    NSData *data = [line dataUsingEncoding:NSUTF8StringEncoding];
    if (![[NSFileManager defaultManager] fileExistsAtPath:logURL.path]) {
        [data writeToURL:logURL atomically:YES];
        return;
    }
    NSFileHandle *handle = [NSFileHandle fileHandleForWritingAtPath:logURL.path];
    [handle seekToEndOfFile];
    [handle writeData:data];
    [handle closeFile];
}

@end
