#import "PiPManager.h"
#import <AVFoundation/AVFoundation.h>
#import <UIKit/UIKit.h>

@interface PiPManager () <AVPictureInPictureControllerDelegate>

@property (nonatomic, strong) AVPictureInPictureController *pipController;
@property (nonatomic, strong) AVPlayer *player;
@property (nonatomic, strong) AVPlayerLayer *playerLayer;
@property (nonatomic, copy) NSString *line1;
@property (nonatomic, copy) NSString *line2;
@property (nonatomic, strong) UIView *hostingView;
@property (nonatomic, assign) BOOL observingPossible;
@property (nonatomic, assign) BOOL didRequestStart;
@property (nonatomic, weak) UIView *attachedView;

@end

@implementation PiPManager

+ (instancetype)sharedManager {
    static PiPManager *manager = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        manager = [[PiPManager alloc] init];
    });
    return manager;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _line1 = @"1号预言家2金水 警徽流 3、8";
        _line2 = @"9号预言家8金水 警徽流 10、4";
    }
    return self;
}

- (BOOL)isPiPActive {
    return self.pipController.isPictureInPictureActive;
}

- (void)startPiP {
    dispatch_async(dispatch_get_main_queue(), ^{
        [self startPiPOnMain];
    });
}

- (void)startPiPOnMain {
    if (self.pipController != nil && self.pipController.isPictureInPictureActive) {
        return;
    }
    NSLog(@"[PiP] start requested");

    if (![AVPictureInPictureController isPictureInPictureSupported]) {
        NSLog(@"[PiP] not supported");
        return;
    }

    AVAudioSession *session = [AVAudioSession sharedInstance];
    [session setCategory:AVAudioSessionCategoryPlayback error:nil];
    [session setActive:YES error:nil];

    [self setupPlayerPiP];
    if (self.pipController == nil) {
        NSLog(@"[PiP] controller nil");
        return;
    }

    if (self.attachedView != nil) {
        [self.attachedView.layer addSublayer:self.playerLayer];
        self.playerLayer.frame = self.attachedView.bounds;
    } else if (self.hostingView == nil) {
        self.hostingView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 1, 1)];
        self.hostingView.alpha = 0.01;
        UIWindow *window = [self activeWindow];
        if (window != nil) {
            [window addSubview:self.hostingView];
            [self.hostingView.layer addSublayer:self.playerLayer];
            self.playerLayer.frame = self.hostingView.bounds;
        }
    } else {
        [self.hostingView.layer addSublayer:self.playerLayer];
        self.playerLayer.frame = self.hostingView.bounds;
    }

    if (!self.observingPossible) {
        self.observingPossible = YES;
        [self.pipController addObserver:self forKeyPath:@"pictureInPicturePossible" options:NSKeyValueObservingOptionNew context:nil];
    }

    self.didRequestStart = NO;
    [self.player play];
    [self startPiPIfReady];
}

- (void)attachToView:(UIView *)view {
    self.attachedView = view;
    if (self.playerLayer != nil) {
        [self.playerLayer removeFromSuperlayer];
        [view.layer addSublayer:self.playerLayer];
        self.playerLayer.frame = view.bounds;
    }
}

- (void)stopPiP {
    if (self.observingPossible) {
        self.observingPossible = NO;
        @try {
            [self.pipController removeObserver:self forKeyPath:@"pictureInPicturePossible"];
        } @catch (NSException *exception) {
        }
    }
    [self.pipController stopPictureInPicture];
    [self.player pause];
}

- (void)updateLine1:(NSString *)line1 line2:(NSString *)line2 {
    self.line1 = line1 ?: @"";
    self.line2 = line2 ?: @"";
    if (self.player != nil) {
        [self reloadPlayerItem];
    }
}

#pragma mark - AVPictureInPictureControllerDelegate

- (void)pictureInPictureController:(AVPictureInPictureController *)pictureInPictureController failedToStartPictureInPictureWithError:(NSError *)error {
    NSLog(@"[PiP] failed to start: %@", error);
}

- (void)pictureInPictureControllerDidStartPictureInPicture:(AVPictureInPictureController *)pictureInPictureController {
    NSLog(@"[PiP] did start");
}

- (void)pictureInPictureControllerDidStopPictureInPicture:(AVPictureInPictureController *)pictureInPictureController {
    NSLog(@"[PiP] did stop");
}

#pragma mark - KVO

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary<NSKeyValueChangeKey,id> *)change context:(void *)context {
    if ([keyPath isEqualToString:@"pictureInPicturePossible"]) {
        BOOL possible = self.pipController.isPictureInPicturePossible;
        NSLog(@"[PiP] possible=%@", possible ? @"YES" : @"NO");
        if (possible) {
            [self startPiPIfReady];
        }
        return;
    }
    [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
}

#pragma mark - Player PiP

- (void)setupPlayerPiP {
    NSURL *videoURL = [self renderTextVideo];
    if (videoURL == nil) {
        NSLog(@"[PiP] render video failed");
        return;
    }
    AVPlayerItem *item = [AVPlayerItem playerItemWithURL:videoURL];
    self.player = [AVPlayer playerWithPlayerItem:item];
    self.player.actionAtItemEnd = AVPlayerActionAtItemEndNone;
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(loopPlayerItem:) name:AVPlayerItemDidPlayToEndTimeNotification object:item];

    self.playerLayer = [AVPlayerLayer playerLayerWithPlayer:self.player];
    self.playerLayer.videoGravity = AVLayerVideoGravityResizeAspect;

    self.pipController = [[AVPictureInPictureController alloc] initWithPlayerLayer:self.playerLayer];
    self.pipController.delegate = self;
    if (@available(iOS 14.2, *)) {
        self.pipController.canStartPictureInPictureAutomaticallyFromInline = YES;
    }
}

- (void)reloadPlayerItem {
    NSURL *videoURL = [self renderTextVideo];
    if (videoURL == nil || self.player == nil) {
        return;
    }
    AVPlayerItem *item = [AVPlayerItem playerItemWithURL:videoURL];
    [[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(loopPlayerItem:) name:AVPlayerItemDidPlayToEndTimeNotification object:item];
    [self.player replaceCurrentItemWithPlayerItem:item];
    [self.player play];
}

- (void)loopPlayerItem:(NSNotification *)note {
    AVPlayerItem *item = note.object;
    [item seekToTime:kCMTimeZero completionHandler:nil];
}

- (void)startPiPIfReady {
    if (self.didRequestStart) {
        return;
    }
    self.didRequestStart = YES;
    dispatch_async(dispatch_get_main_queue(), ^{
        if (!self.pipController.isPictureInPictureActive) {
            [self.pipController startPictureInPicture];
        }
    });
}

- (NSURL *)renderTextVideo {
    NSURL *dir = [NSURL fileURLWithPath:NSTemporaryDirectory() isDirectory:YES];
    NSURL *url = [dir URLByAppendingPathComponent:@"pip_preview.mp4"];
    [[NSFileManager defaultManager] removeItemAtURL:url error:nil];

    NSError *error = nil;
    AVAssetWriter *writer = [[AVAssetWriter alloc] initWithURL:url fileType:AVFileTypeMPEG4 error:&error];
    if (error != nil) {
        NSLog(@"[PiP] writer error: %@", error);
        return nil;
    }

    NSDictionary *videoSettings = @{
        AVVideoCodecKey: AVVideoCodecTypeH264,
        AVVideoWidthKey: @640,
        AVVideoHeightKey: @360
    };
    AVAssetWriterInput *input = [AVAssetWriterInput assetWriterInputWithMediaType:AVMediaTypeVideo outputSettings:videoSettings];
    input.expectsMediaDataInRealTime = NO;

    NSDictionary *attrs = @{
        (NSString *)kCVPixelBufferPixelFormatTypeKey: @(kCVPixelFormatType_32BGRA),
        (NSString *)kCVPixelBufferWidthKey: @640,
        (NSString *)kCVPixelBufferHeightKey: @360
    };
    AVAssetWriterInputPixelBufferAdaptor *adaptor = [[AVAssetWriterInputPixelBufferAdaptor alloc] initWithAssetWriterInput:input sourcePixelBufferAttributes:attrs];

    if ([writer canAddInput:input]) {
        [writer addInput:input];
    }

    [writer startWriting];
    [writer startSessionAtSourceTime:kCMTimeZero];

    int fps = 2;
    int frameCount = 8;
    for (int i = 0; i < frameCount; i++) {
        @autoreleasepool {
            CVPixelBufferRef pixelBuffer = NULL;
            CVPixelBufferCreate(kCFAllocatorDefault, 640, 360, kCVPixelFormatType_32BGRA, (__bridge CFDictionaryRef)@{}, &pixelBuffer);
            CVPixelBufferLockBaseAddress(pixelBuffer, 0);
            void *baseAddress = CVPixelBufferGetBaseAddress(pixelBuffer);
            size_t bytesPerRow = CVPixelBufferGetBytesPerRow(pixelBuffer);
            CGColorSpaceRef colorSpace = CGColorSpaceCreateDeviceRGB();
            CGContextRef context = CGBitmapContextCreate(baseAddress, 640, 360, 8, bytesPerRow, colorSpace, kCGImageAlphaPremultipliedFirst | kCGBitmapByteOrder32Little);

            CGContextSetRGBFillColor(context, 0.05, 0.05, 0.08, 1.0);
            CGContextFillRect(context, CGRectMake(0, 0, 640, 360));

            // 修正文本坐标系：确保文字左上角、从左到右正常显示
            CGContextTranslateCTM(context, 0, 360);
            CGContextScaleCTM(context, 1.0, -1.0);

            NSDictionary *textAttrs = @{
                NSFontAttributeName: [UIFont systemFontOfSize:22],
                NSForegroundColorAttributeName: [UIColor whiteColor]
            };
            UIGraphicsPushContext(context);
            [self.line1 drawInRect:CGRectMake(24, 36, 640 - 48, 40) withAttributes:textAttrs];
            [self.line2 drawInRect:CGRectMake(24, 92, 640 - 48, 60) withAttributes:textAttrs];
            UIGraphicsPopContext();

            CGContextRelease(context);
            CGColorSpaceRelease(colorSpace);
            CVPixelBufferUnlockBaseAddress(pixelBuffer, 0);

            while (!input.isReadyForMoreMediaData) {
                [NSThread sleepForTimeInterval:0.01];
            }
            CMTime frameTime = CMTimeMake(i, fps);
            [adaptor appendPixelBuffer:pixelBuffer withPresentationTime:frameTime];
            CVPixelBufferRelease(pixelBuffer);
        }
    }

    [input markAsFinished];
    dispatch_semaphore_t sema = dispatch_semaphore_create(0);
    [writer finishWritingWithCompletionHandler:^{
        dispatch_semaphore_signal(sema);
    }];
    dispatch_semaphore_wait(sema, dispatch_time(DISPATCH_TIME_NOW, (int64_t)(2 * NSEC_PER_SEC)));
    return url;
}

- (UIWindow *)activeWindow {
    for (UIScene *scene in UIApplication.sharedApplication.connectedScenes) {
        if (scene.activationState != UISceneActivationStateForegroundActive) {
            continue;
        }
        if (![scene isKindOfClass:[UIWindowScene class]]) {
            continue;
        }
        UIWindowScene *windowScene = (UIWindowScene *)scene;
        for (UIWindow *window in windowScene.windows) {
            if (window.isKeyWindow) {
                return window;
            }
        }
        if (windowScene.windows.count > 0) {
            return windowScene.windows.firstObject;
        }
    }
    return UIApplication.sharedApplication.windows.firstObject;
}

@end
