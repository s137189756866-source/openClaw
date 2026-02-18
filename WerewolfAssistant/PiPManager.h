#import <Foundation/Foundation.h>
#import <AVKit/AVKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface PiPManager : NSObject

+ (instancetype)sharedManager;
- (BOOL)isPiPActive;
- (void)startPiP;
- (void)stopPiP;
- (void)updateLine1:(NSString *)line1 line2:(NSString *)line2;
- (void)attachToView:(UIView *)view;

@end

NS_ASSUME_NONNULL_END
