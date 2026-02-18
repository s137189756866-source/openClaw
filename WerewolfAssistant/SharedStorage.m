#import "SharedStorage.h"

@implementation SharedStorage

+ (NSURL *)sharedContainerURL {
    NSURL *container = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.code.WerewolfAssistant"];
    if (container != nil) {
        return container;
    }
    NSURL *documents = [[[NSFileManager defaultManager] URLsForDirectory:NSDocumentDirectory inDomains:NSUserDomainMask] firstObject];
    return documents;
}

+ (NSURL *)capturesDirectoryURL {
    NSURL *base = [self sharedContainerURL];
    NSURL *dir = [base URLByAppendingPathComponent:@"captures" isDirectory:YES];
    if (![[NSFileManager defaultManager] fileExistsAtPath:dir.path]) {
        [[NSFileManager defaultManager] createDirectoryAtURL:dir withIntermediateDirectories:YES attributes:nil error:nil];
    }
    return dir;
}

+ (NSURL *)markersFileURL {
    return [[self sharedContainerURL] URLByAppendingPathComponent:@"markers.json"];
}

+ (NSURL *)liveOCRFileURL {
    return [[self sharedContainerURL] URLByAppendingPathComponent:@"live_ocr.json"];
}

+ (NSURL *)liveOCREnabledFileURL {
    return [[self sharedContainerURL] URLByAppendingPathComponent:@"live_ocr_enabled.json"];
}

@end
