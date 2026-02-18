#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface OCRConfig : NSObject

+ (CGRect)loadNormalizedROI;
+ (void)saveNormalizedROI:(CGRect)roi;

@end

NS_ASSUME_NONNULL_END
