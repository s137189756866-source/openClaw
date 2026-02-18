#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface KeywordExtractor : NSObject

+ (NSArray<NSString *> *)extractKeywordsFromTranscript:(NSString *)transcript;

@end

NS_ASSUME_NONNULL_END
