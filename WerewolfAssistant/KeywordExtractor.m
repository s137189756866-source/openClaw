#import "KeywordExtractor.h"

@implementation KeywordExtractor

+ (NSArray<NSString *> *)extractKeywordsFromTranscript:(NSString *)transcript {
    if (transcript.length == 0) {
        return @[];
    }
    NSArray<NSString *> *keywords = @[
        @"金水", @"查杀", @"悍跳", @"警徽流", @"倒钩", @"穿神", @"抿身份", @"防爆",
        @"站边", @"投票", @"狼", @"神", @"村", @"女巫", @"预言家", @"狼王", @"商人",
        @"自救", @"毒", @"验人", @"护盾", @"爆", @"对跳"
    ];

    NSMutableArray<NSString *> *found = [[NSMutableArray alloc] init];
    for (NSString *keyword in keywords) {
        if ([transcript rangeOfString:keyword].location != NSNotFound) {
            [found addObject:keyword];
        }
    }
    return found;
}

@end
