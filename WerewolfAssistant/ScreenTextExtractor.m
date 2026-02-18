#import "ScreenTextExtractor.h"
#import "SharedStorage.h"
#import <AVFoundation/AVFoundation.h>
#import <Vision/Vision.h>

@implementation ScreenTextExtractor

+ (instancetype)sharedExtractor {
    static ScreenTextExtractor *extractor = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        extractor = [[ScreenTextExtractor alloc] init];
    });
    return extractor;
}

- (void)extractLatestScreenTextWithCompletion:(void (^)(NSString * _Nullable text, NSError * _Nullable error))completion {
    NSURL *capturesDir = [SharedStorage capturesDirectoryURL];
    NSArray<NSURL *> *files = [[NSFileManager defaultManager] contentsOfDirectoryAtURL:capturesDir includingPropertiesForKeys:@[NSURLCreationDateKey] options:0 error:nil];
    if (files.count == 0) {
        NSError *error = [NSError errorWithDomain:@"ScreenText" code:404 userInfo:@{NSLocalizedDescriptionKey: @"未找到录制文件"}];
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
        NSError *error = [NSError errorWithDomain:@"ScreenText" code:404 userInfo:@{NSLocalizedDescriptionKey: @"未找到录制文件"}];
        completion(nil, error);
        return;
    }

    AVAsset *asset = [AVAsset assetWithURL:latest];
    AVAssetImageGenerator *generator = [[AVAssetImageGenerator alloc] initWithAsset:asset];
    generator.appliesPreferredTrackTransform = YES;
    CMTime time = CMTimeMakeWithSeconds(1.0, 600);

    NSError *imageError = nil;
    CGImageRef image = [generator copyCGImageAtTime:time actualTime:nil error:&imageError];
    if (image == nil || imageError != nil) {
        completion(nil, imageError);
        if (image != nil) {
            CGImageRelease(image);
        }
        return;
    }

    VNRecognizeTextRequest *request = [[VNRecognizeTextRequest alloc] initWithCompletionHandler:^(VNRequest * _Nonnull req, NSError * _Nullable error) {
        if (error != nil) {
            completion(nil, error);
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
        completion(joined.length > 0 ? joined : @"", nil);
    }];
    request.recognitionLevel = VNRequestTextRecognitionLevelFast;
    request.usesLanguageCorrection = NO;
    request.recognitionLanguages = @[@"zh-Hans", @"en-US"];

    VNImageRequestHandler *handler = [[VNImageRequestHandler alloc] initWithCGImage:image options:@{}];
    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        NSError *err = nil;
        [handler performRequests:@[request] error:&err];
        if (err != nil) {
            completion(nil, err);
        }
        CGImageRelease(image);
    });
}

@end
