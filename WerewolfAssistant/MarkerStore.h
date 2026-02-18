#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

typedef NS_ENUM(NSInteger, MarkerType) {
    MarkerTypeSpeechStart = 0,
    MarkerTypeVoteStart = 1,
    MarkerTypeVoteEnd = 2,
};

@interface MarkerStore : NSObject

+ (instancetype)sharedStore;
- (void)addMarkerWithType:(MarkerType)type note:(nullable NSString *)note;
- (NSArray<NSDictionary *> *)loadMarkers;

@end

NS_ASSUME_NONNULL_END
