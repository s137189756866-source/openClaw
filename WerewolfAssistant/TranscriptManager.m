#import "TranscriptManager.h"
#import "SharedStorage.h"
#import <Speech/Speech.h>
#import <AVFoundation/AVFoundation.h>

@interface TranscriptManager ()
@property (nonatomic, strong) SFSpeechRecognizer *recognizer;
@end

@implementation TranscriptManager

+ (instancetype)sharedManager {
    static TranscriptManager *manager = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        manager = [[TranscriptManager alloc] init];
    });
    return manager;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        _recognizer = [[SFSpeechRecognizer alloc] initWithLocale:[NSLocale localeWithLocaleIdentifier:@"zh-CN"]];
    }
    return self;
}

- (void)transcribeLatestWithCompletion:(void (^)(NSString * _Nullable transcript, NSError * _Nullable error))completion {
    NSURL *capturesDir = [SharedStorage capturesDirectoryURL];
    NSArray<NSURL *> *files = [[NSFileManager defaultManager] contentsOfDirectoryAtURL:capturesDir includingPropertiesForKeys:@[NSURLCreationDateKey] options:0 error:nil];
    if (files.count == 0) {
        NSError *error = [NSError errorWithDomain:@"Transcript" code:404 userInfo:@{NSLocalizedDescriptionKey: @"未找到录制文件"}];
        completion(nil, error);
        return;
    }

    NSArray<NSURL *> *sorted = [files sortedArrayUsingComparator:^NSComparisonResult(NSURL *a, NSURL *b) {
        NSDate *da = nil;
        NSDate *db = nil;
        [a getResourceValue:&da forKey:NSURLCreationDateKey error:nil];
        [b getResourceValue:&db forKey:NSURLCreationDateKey error:nil];
        return [db compare:da];
    }];

    NSURL *latest = sorted.firstObject;
    if (latest == nil) {
        NSError *error = [NSError errorWithDomain:@"Transcript" code:404 userInfo:@{NSLocalizedDescriptionKey: @"未找到录制文件"}];
        completion(nil, error);
        return;
    }

    [self extractAudioFromVideo:latest completion:^(NSURL * _Nullable audioURL, NSError * _Nullable error) {
        if (audioURL == nil || error != nil) {
            completion(nil, error);
            return;
        }
        [self transcribeAudioURL:audioURL completion:completion];
    }];
}

- (void)extractAudioFromVideo:(NSURL *)videoURL completion:(void (^)(NSURL * _Nullable audioURL, NSError * _Nullable error))completion {
    AVAsset *asset = [AVAsset assetWithURL:videoURL];
    NSString *fileName = [NSString stringWithFormat:@"audio_%@.m4a", [[NSUUID UUID] UUIDString]];
    NSURL *outputURL = [[SharedStorage capturesDirectoryURL] URLByAppendingPathComponent:fileName];

    if ([[NSFileManager defaultManager] fileExistsAtPath:outputURL.path]) {
        [[NSFileManager defaultManager] removeItemAtURL:outputURL error:nil];
    }

    AVAssetExportSession *exporter = [[AVAssetExportSession alloc] initWithAsset:asset presetName:AVAssetExportPresetAppleM4A];
    exporter.outputURL = outputURL;
    exporter.outputFileType = AVFileTypeAppleM4A;
    exporter.timeRange = CMTimeRangeFromTimeToTime(kCMTimeZero, asset.duration);

    [exporter exportAsynchronouslyWithCompletionHandler:^{
        if (exporter.status == AVAssetExportSessionStatusCompleted) {
            completion(outputURL, nil);
        } else {
            NSError *error = exporter.error ?: [NSError errorWithDomain:@"Transcript" code:500 userInfo:@{NSLocalizedDescriptionKey: @"音频导出失败"}];
            completion(nil, error);
        }
    }];
}

- (void)transcribeAudioURL:(NSURL *)audioURL completion:(void (^)(NSString * _Nullable transcript, NSError * _Nullable error))completion {
    SFSpeechURLRecognitionRequest *request = [[SFSpeechURLRecognitionRequest alloc] initWithURL:audioURL];
    request.shouldReportPartialResults = NO;

    [self.recognizer recognitionTaskWithRequest:request resultHandler:^(SFSpeechRecognitionResult * _Nullable result, NSError * _Nullable error) {
        if (error != nil) {
            completion(nil, error);
            return;
        }
        if (result.isFinal) {
            completion(result.bestTranscription.formattedString, nil);
        }
    }];
}

@end
