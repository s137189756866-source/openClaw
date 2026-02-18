#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface SharedStorage : NSObject

+ (NSURL *)sharedContainerURL;
+ (NSURL *)capturesDirectoryURL;
+ (NSURL *)markersFileURL;
+ (NSURL *)liveOCRFileURL;
+ (NSURL *)liveOCREnabledFileURL;

@end

NS_ASSUME_NONNULL_END
