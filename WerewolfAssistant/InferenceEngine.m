#import "InferenceEngine.h"

@implementation InferenceEngine

+ (NSString *)summaryFromKeywords:(NSArray<NSString *> *)keywords {
    NSSet<NSString *> *set = [NSSet setWithArray:keywords];
    BOOL hasWolf = [set containsObject:@"查杀"] || [set containsObject:@"狼"] || [set containsObject:@"狼王"];
    BOOL hasGood = [set containsObject:@"金水"] || [set containsObject:@"好人"] || [set containsObject:@"预言家"] || [set containsObject:@"女巫"];

    if (hasWolf && !hasGood) {
        return @"阵营倾向：偏狼（基于关键词）";
    }
    if (hasGood && !hasWolf) {
        return @"阵营倾向：偏好（基于关键词）";
    }
    if (hasWolf && hasGood) {
        return @"阵营倾向：冲突，需结合投票与时序";
    }
    return @"阵营倾向：信息不足";
}

@end
