#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface TranscriptManager : NSObject

+ (instancetype)sharedManager;
- (void)transcribeLatestWithCompletion:(void (^)(NSString * _Nullable transcript, NSError * _Nullable error))completion;

@end

NS_ASSUME_NONNULL_END
