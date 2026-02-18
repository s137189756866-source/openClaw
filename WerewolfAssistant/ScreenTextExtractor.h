#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ScreenTextExtractor : NSObject

+ (instancetype)sharedExtractor;
- (void)extractLatestScreenTextWithCompletion:(void (^)(NSString * _Nullable text, NSError * _Nullable error))completion;

@end

NS_ASSUME_NONNULL_END
