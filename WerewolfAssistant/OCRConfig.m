#import "OCRConfig.h"
#import "SharedStorage.h"
#import <CoreGraphics/CoreGraphics.h>

@implementation OCRConfig

+ (CGRect)loadNormalizedROI {
    NSURL *fileURL = [SharedStorage liveOCRFileURL];
    NSURL *configURL = [[fileURL URLByDeletingLastPathComponent] URLByAppendingPathComponent:@"ocr_roi.json"];
    NSData *data = [NSData dataWithContentsOfURL:configURL];
    if (data == nil) {
        return CGRectMake(0, 0, 1, 1);
    }
    id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![json isKindOfClass:[NSDictionary class]]) {
        return CGRectMake(0, 0, 1, 1);
    }
    NSDictionary *dict = (NSDictionary *)json;
    CGFloat x = [dict[@"x"] doubleValue];
    CGFloat y = [dict[@"y"] doubleValue];
    CGFloat w = [dict[@"w"] doubleValue];
    CGFloat h = [dict[@"h"] doubleValue];
    if (w <= 0 || h <= 0) {
        return CGRectMake(0, 0, 1, 1);
    }
    return CGRectMake(x, y, w, h);
}

+ (void)saveNormalizedROI:(CGRect)roi {
    NSURL *fileURL = [SharedStorage liveOCRFileURL];
    NSURL *configURL = [[fileURL URLByDeletingLastPathComponent] URLByAppendingPathComponent:@"ocr_roi.json"];
    NSDictionary *dict = @{
        @"x": @(roi.origin.x),
        @"y": @(roi.origin.y),
        @"w": @(roi.size.width),
        @"h": @(roi.size.height)
    };
    NSData *data = [NSJSONSerialization dataWithJSONObject:dict options:NSJSONWritingPrettyPrinted error:nil];
    if (data != nil) {
        [data writeToURL:configURL atomically:YES];
    }
}

@end
