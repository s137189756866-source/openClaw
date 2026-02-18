#import "MarkerStore.h"
#import "SharedStorage.h"

@implementation MarkerStore

+ (instancetype)sharedStore {
    static MarkerStore *store = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        store = [[MarkerStore alloc] init];
    });
    return store;
}

- (NSArray<NSDictionary *> *)loadMarkers {
    NSURL *fileURL = [SharedStorage markersFileURL];
    NSData *data = [NSData dataWithContentsOfURL:fileURL];
    if (data == nil) {
        return @[];
    }
    id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if ([json isKindOfClass:[NSArray class]]) {
        return (NSArray<NSDictionary *> *)json;
    }
    return @[];
}

- (void)addMarkerWithType:(MarkerType)type note:(nullable NSString *)note {
    NSMutableArray<NSDictionary *> *markers = [[self loadMarkers] mutableCopy];
    if (markers == nil) {
        markers = [[NSMutableArray alloc] init];
    }
    NSTimeInterval timestamp = [[NSDate date] timeIntervalSince1970];
    NSDictionary *entry = @{
        @"type": @(type),
        @"timestamp": @(timestamp),
        @"note": note ?: @""
    };
    [markers addObject:entry];

    NSData *data = [NSJSONSerialization dataWithJSONObject:markers options:NSJSONWritingPrettyPrinted error:nil];
    if (data != nil) {
        [data writeToURL:[SharedStorage markersFileURL] atomically:YES];
    }
}

@end
