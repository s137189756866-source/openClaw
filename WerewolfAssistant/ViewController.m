#import "ViewController.h"
#import <ReplayKit/ReplayKit.h>
#import <Speech/Speech.h>
#import <MediaPlayer/MediaPlayer.h>
#import <AVFoundation/AVFoundation.h>
#import <math.h>

#import "MarkerStore.h"
#import "KeywordExtractor.h"
#import "TranscriptManager.h"
#import "PiPManager.h"
#import "InferenceEngine.h"
#import "SharedStorage.h"
#import "ScreenTextExtractor.h"
#import "OCRConfig.h"

@interface ViewController ()

@property (nonatomic, strong) UILabel *statusLabel;
@property (nonatomic, strong) UITextView *transcriptView;
@property (nonatomic, strong) UITextView *keywordsView;
@property (nonatomic, strong) UILabel *inferenceLabel;
@property (nonatomic, strong) UISegmentedControl *markerSegment;
@property (nonatomic, strong) UILabel *pipStatusLabel;
@property (nonatomic, strong) UILabel *volumeStatusLabel;
@property (nonatomic, assign) float lastVolume;
@property (nonatomic, strong) MPVolumeView *volumeView;
@property (nonatomic, strong) RPSystemBroadcastPickerView *broadcastPicker;
@property (nonatomic, strong) UIView *pipPreviewView;
@property (nonatomic, strong) NSTimer *ocrTimer;
@property (nonatomic, copy) NSString *lastOCRSpeaker;
@property (nonatomic, copy) NSString *lastOCRText;
@property (nonatomic, strong) UITextField *roiXField;
@property (nonatomic, strong) UITextField *roiYField;
@property (nonatomic, strong) UITextField *roiWField;
@property (nonatomic, strong) UITextField *roiHField;
@property (nonatomic, strong) UISwitch *liveOCRSwitch;

@end

@implementation ViewController

- (void)viewDidLoad {
    [super viewDidLoad];

    self.view.backgroundColor = [UIColor systemBackgroundColor];
    [self setupUI];
    [self requestSpeechAuthorization];
    [self setupVolumeMonitoring];
    [self startLiveOCRPolling];
}

- (void)dealloc {
    [[AVAudioSession sharedInstance] removeObserver:self forKeyPath:@"outputVolume" context:nil];
    [self.ocrTimer invalidate];
}

#pragma mark - UI

- (void)setupUI {
    UILabel *titleLabel = [[UILabel alloc] init];
    titleLabel.text = @"WerewolfAssistant Demo";
    titleLabel.font = [UIFont boldSystemFontOfSize:22];

    self.statusLabel = [[UILabel alloc] init];
    self.statusLabel.text = @"状态：待录制";
    self.statusLabel.numberOfLines = 0;

    self.pipStatusLabel = [[UILabel alloc] init];
    self.pipStatusLabel.text = @"PiP：未开启";
    self.pipStatusLabel.numberOfLines = 0;

    self.volumeStatusLabel = [[UILabel alloc] init];
    self.volumeStatusLabel.text = @"音量打点：未触发";
    self.volumeStatusLabel.numberOfLines = 0;

    UILabel *pickerLabel = [[UILabel alloc] init];
    pickerLabel.text = @"录屏启动（系统广播）";
    pickerLabel.font = [UIFont systemFontOfSize:14];

    self.broadcastPicker = [[RPSystemBroadcastPickerView alloc] initWithFrame:CGRectMake(0, 0, 200, 50)];
    self.broadcastPicker.preferredExtension = @"code.WerewolfAssistant.WerewolfAssistant.Broadcast";
    self.broadcastPicker.showsMicrophoneButton = YES;
    self.broadcastPicker.backgroundColor = [UIColor systemGray5Color];
    UILabel *pickerHintLabel = [[UILabel alloc] init];
    pickerHintLabel.text = @"点击上方按钮选择 WerewolfAssistantBroadcast 并开始录制";
    pickerHintLabel.font = [UIFont systemFontOfSize:12];
    pickerHintLabel.textColor = [UIColor secondaryLabelColor];

    UIButton *broadcastTapButton = [self buttonWithTitle:@"开始录屏" action:@selector(tapBroadcastPicker)];

    UIButton *pipStartButton = [self buttonWithTitle:@"启动 PiP" action:@selector(startPiP)];
    UIButton *pipStopButton = [self buttonWithTitle:@"停止 PiP" action:@selector(stopPiP)];
    UILabel *pipPreviewLabel = [[UILabel alloc] init];
    pipPreviewLabel.text = @"PiP 预览";
    pipPreviewLabel.font = [UIFont systemFontOfSize:14];

    self.pipPreviewView = [[UIView alloc] initWithFrame:CGRectMake(0, 0, 200, 112)];
    self.pipPreviewView.backgroundColor = [UIColor systemGray6Color];
    self.pipPreviewView.layer.borderColor = [UIColor systemGray4Color].CGColor;
    self.pipPreviewView.layer.borderWidth = 1.0;

    UILabel *markerLabel = [[UILabel alloc] init];
    markerLabel.text = @"音量键打点类型";
    markerLabel.font = [UIFont systemFontOfSize:14];

    self.markerSegment = [[UISegmentedControl alloc] initWithItems:@[@"发言开始", @"投票开始", @"投票结束"]];
    self.markerSegment.selectedSegmentIndex = 0;

    UILabel *roiLabel = [[UILabel alloc] init];
    roiLabel.text = @"OCR 区域 (0-1 归一化 x/y/w/h)";
    roiLabel.font = [UIFont systemFontOfSize:14];

    self.roiXField = [self roiFieldWithPlaceholder:@"x"];
    self.roiYField = [self roiFieldWithPlaceholder:@"y"];
    self.roiWField = [self roiFieldWithPlaceholder:@"w"];
    self.roiHField = [self roiFieldWithPlaceholder:@"h"];

    UIStackView *roiStack = [[UIStackView alloc] initWithArrangedSubviews:@[
        self.roiXField,
        self.roiYField,
        self.roiWField,
        self.roiHField
    ]];
    roiStack.axis = UILayoutConstraintAxisHorizontal;
    roiStack.spacing = 8;
    roiStack.distribution = UIStackViewDistributionFillEqually;

    UIButton *saveROIButton = [self buttonWithTitle:@"保存 OCR 区域" action:@selector(saveROI)];

    UILabel *liveOCRLabel = [[UILabel alloc] init];
    liveOCRLabel.text = @"实时发言识别";
    liveOCRLabel.font = [UIFont systemFontOfSize:14];
    self.liveOCRSwitch = [[UISwitch alloc] init];
    [self.liveOCRSwitch addTarget:self action:@selector(toggleLiveOCR:) forControlEvents:UIControlEventValueChanged];
    UIStackView *liveOCRStack = [[UIStackView alloc] initWithArrangedSubviews:@[liveOCRLabel, self.liveOCRSwitch]];
    liveOCRStack.axis = UILayoutConstraintAxisHorizontal;
    liveOCRStack.spacing = 8;
    liveOCRStack.alignment = UIStackViewAlignmentCenter;

    UIButton *manualMarkerButton = [self buttonWithTitle:@"手动打点" action:@selector(addManualMarker)];
    UIButton *transcribeButton = [self buttonWithTitle:@"转写最新录制" action:@selector(transcribeLatest)];
    UIButton *extractButton = [self buttonWithTitle:@"提取关键词" action:@selector(extractKeywords)];
    UIButton *logButton = [self buttonWithTitle:@"查看录屏日志" action:@selector(showBroadcastLog)];

    UILabel *transcriptLabel = [[UILabel alloc] init];
    transcriptLabel.text = @"转写内容";
    transcriptLabel.font = [UIFont systemFontOfSize:14];

    self.transcriptView = [[UITextView alloc] init];
    self.transcriptView.layer.borderColor = [UIColor systemGray4Color].CGColor;
    self.transcriptView.layer.borderWidth = 1.0;
    self.transcriptView.text = @"";

    UILabel *keywordsLabel = [[UILabel alloc] init];
    keywordsLabel.text = @"关键词";
    keywordsLabel.font = [UIFont systemFontOfSize:14];

    self.keywordsView = [[UITextView alloc] init];
    self.keywordsView.layer.borderColor = [UIColor systemGray4Color].CGColor;
    self.keywordsView.layer.borderWidth = 1.0;
    self.keywordsView.text = @"";

    self.inferenceLabel = [[UILabel alloc] init];
    self.inferenceLabel.text = @"阵营倾向：信息不足";
    self.inferenceLabel.numberOfLines = 0;

    UIStackView *stack = [[UIStackView alloc] initWithArrangedSubviews:@[
        titleLabel,
        self.statusLabel,
        pickerLabel,
        self.broadcastPicker,
        broadcastTapButton,
        pickerHintLabel,
        self.pipStatusLabel,
        pipPreviewLabel,
        self.pipPreviewView,
        pipStartButton,
        pipStopButton,
        roiLabel,
        roiStack,
        saveROIButton,
        liveOCRStack,
        markerLabel,
        self.markerSegment,
        self.volumeStatusLabel,
        manualMarkerButton,
        transcribeButton,
        extractButton,
        logButton,
        transcriptLabel,
        self.transcriptView,
        keywordsLabel,
        self.keywordsView,
        self.inferenceLabel
    ]];
    stack.axis = UILayoutConstraintAxisVertical;
    stack.spacing = 10;
    stack.translatesAutoresizingMaskIntoConstraints = NO;

    [self.view addSubview:stack];
    [NSLayoutConstraint activateConstraints:@[
        [stack.topAnchor constraintEqualToAnchor:self.view.safeAreaLayoutGuide.topAnchor constant:16],
        [stack.leadingAnchor constraintEqualToAnchor:self.view.leadingAnchor constant:16],
        [stack.trailingAnchor constraintEqualToAnchor:self.view.trailingAnchor constant:-16],
        [self.broadcastPicker.heightAnchor constraintEqualToConstant:50],
        [self.pipPreviewView.heightAnchor constraintEqualToConstant:112],
        [self.roiXField.heightAnchor constraintEqualToConstant:36],
        [self.transcriptView.heightAnchor constraintEqualToConstant:120],
        [self.keywordsView.heightAnchor constraintEqualToConstant:80],
    ]];

    [self loadROIFields];
    [self loadLiveOCRSwitch];
}

- (UIButton *)buttonWithTitle:(NSString *)title action:(SEL)action {
    UIButton *button = [UIButton buttonWithType:UIButtonTypeSystem];
    [button setTitle:title forState:UIControlStateNormal];
    [button addTarget:self action:action forControlEvents:UIControlEventTouchUpInside];
    button.titleLabel.font = [UIFont boldSystemFontOfSize:16];
    button.layer.cornerRadius = 8;
    button.layer.borderColor = [UIColor systemBlueColor].CGColor;
    button.layer.borderWidth = 1.0;
    button.contentEdgeInsets = UIEdgeInsetsMake(10, 12, 10, 12);
    return button;
}

- (UITextField *)roiFieldWithPlaceholder:(NSString *)placeholder {
    UITextField *field = [[UITextField alloc] init];
    field.placeholder = placeholder;
    field.borderStyle = UITextBorderStyleRoundedRect;
    field.keyboardType = UIKeyboardTypeDecimalPad;
    field.font = [UIFont systemFontOfSize:14];
    return field;
}

#pragma mark - OCR ROI

- (void)loadROIFields {
    CGRect roi = [OCRConfig loadNormalizedROI];
    self.roiXField.text = [NSString stringWithFormat:@"%.2f", roi.origin.x];
    self.roiYField.text = [NSString stringWithFormat:@"%.2f", roi.origin.y];
    self.roiWField.text = [NSString stringWithFormat:@"%.2f", roi.size.width];
    self.roiHField.text = [NSString stringWithFormat:@"%.2f", roi.size.height];
}

- (void)saveROI {
    CGFloat x = [self.roiXField.text doubleValue];
    CGFloat y = [self.roiYField.text doubleValue];
    CGFloat w = [self.roiWField.text doubleValue];
    CGFloat h = [self.roiHField.text doubleValue];
    if (w <= 0 || h <= 0) {
        self.statusLabel.text = @"状态：OCR 区域无效";
        return;
    }
    CGRect roi = CGRectMake(x, y, w, h);
    [OCRConfig saveNormalizedROI:roi];
    self.statusLabel.text = @"状态：OCR 区域已保存";
}

- (void)loadLiveOCRSwitch {
    NSURL *fileURL = [SharedStorage liveOCREnabledFileURL];
    NSData *data = [NSData dataWithContentsOfURL:fileURL];
    BOOL enabled = NO;
    if (data != nil) {
        id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
        if ([json isKindOfClass:[NSDictionary class]]) {
            enabled = [json[@"enabled"] boolValue];
        }
    }
    if (data == nil) {
        enabled = NO;
    }
    self.liveOCRSwitch.on = enabled;
}

- (void)toggleLiveOCR:(UISwitch *)sender {
    NSDictionary *payload = @{@"enabled": @(sender.isOn)};
    NSData *data = [NSJSONSerialization dataWithJSONObject:payload options:0 error:nil];
    if (data != nil) {
        [data writeToURL:[SharedStorage liveOCREnabledFileURL] atomically:YES];
    }
    self.statusLabel.text = sender.isOn ? @"状态：实时识别已开启" : @"状态：实时识别已关闭";
}
#pragma mark - Broadcast Picker

- (void)tapBroadcastPicker {
    for (UIView *view in self.broadcastPicker.subviews) {
        if ([view isKindOfClass:[UIButton class]]) {
            UIButton *button = (UIButton *)view;
            [button sendActionsForControlEvents:UIControlEventTouchUpInside];
            return;
        }
    }
}

#pragma mark - Authorization

- (void)requestSpeechAuthorization {
    [SFSpeechRecognizer requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus status) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (status == SFSpeechRecognizerAuthorizationStatusAuthorized) {
                self.statusLabel.text = @"状态：语音识别已授权";
            } else {
                self.statusLabel.text = @"状态：语音识别未授权";
            }
        });
    }];
}

#pragma mark - Volume Marker

- (void)setupVolumeMonitoring {
    AVAudioSession *session = [AVAudioSession sharedInstance];
    [session setCategory:AVAudioSessionCategoryAmbient error:nil];
    [session setActive:YES error:nil];
    self.lastVolume = session.outputVolume;

    self.volumeView = [[MPVolumeView alloc] initWithFrame:CGRectMake(-100, -100, 10, 10)];
    self.volumeView.alpha = 0.01;
    [self.view addSubview:self.volumeView];

    [session addObserver:self forKeyPath:@"outputVolume" options:NSKeyValueObservingOptionNew context:nil];
}

- (void)observeValueForKeyPath:(NSString *)keyPath ofObject:(id)object change:(NSDictionary<NSKeyValueChangeKey,id> *)change context:(void *)context {
    if (![keyPath isEqualToString:@"outputVolume"]) {
        return;
    }
    float newVolume = [change[NSKeyValueChangeNewKey] floatValue];
    if (fabsf(newVolume - self.lastVolume) < 0.001) {
        return;
    }
    self.lastVolume = newVolume;
    [self addMarkerForCurrentSegmentWithNote:@"音量键打点"]; 
}

- (void)addManualMarker {
    [self addMarkerForCurrentSegmentWithNote:@"手动打点"]; 
}

- (void)addMarkerForCurrentSegmentWithNote:(NSString *)note {
    MarkerType type = (MarkerType)self.markerSegment.selectedSegmentIndex;
    [[MarkerStore sharedStore] addMarkerWithType:type note:note];
    self.volumeStatusLabel.text = [NSString stringWithFormat:@"音量打点：已记录 (%@)", note];
    [self updateRealtimeHintForMarker:type];
}

- (void)updateRealtimeHintForMarker:(MarkerType)type {
    NSString *line1 = @"实时建议";
    NSString *line2 = @"";
    switch (type) {
        case MarkerTypeSpeechStart:
            line2 = @"发言开始：注意记录站边和验人信息";
            break;
        case MarkerTypeVoteStart:
            line2 = @"投票开始：关注票型与警徽流一致性";
            break;
        case MarkerTypeVoteEnd:
            line2 = @"投票结束：检查投票一致性";
            break;
    }
    [[PiPManager sharedManager] updateLine1:line1 line2:line2];
}

#pragma mark - PiP

- (void)startPiP {
    [[PiPManager sharedManager] attachToView:self.pipPreviewView];
    [[PiPManager sharedManager] startPiP];
    self.pipStatusLabel.text = @"PiP：启动中（回到桌面查看浮窗）";
}

- (void)stopPiP {
    [[PiPManager sharedManager] stopPiP];
    self.pipStatusLabel.text = @"PiP：已关闭";
}

#pragma mark - Transcription

- (void)transcribeLatest {
    self.statusLabel.text = @"状态：转写中...";
    [[TranscriptManager sharedManager] transcribeLatestWithCompletion:^(NSString * _Nullable transcript, NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (error != nil) {
                self.statusLabel.text = [NSString stringWithFormat:@"转写失败：%@", error.localizedDescription];
                return;
            }
            self.statusLabel.text = @"状态：转写完成";
            self.transcriptView.text = transcript ?: @"";
            if (transcript.length > 0) {
                NSLog(@"[ASR] %@", transcript);
            }
            [self extractKeywords];
            [self extractScreenText];
        });
    }];
}

- (void)extractKeywords {
    NSString *transcript = self.transcriptView.text ?: @"";
    NSArray<NSString *> *keywords = [KeywordExtractor extractKeywordsFromTranscript:transcript];
    self.keywordsView.text = [keywords componentsJoinedByString:@"、"];
    self.inferenceLabel.text = [InferenceEngine summaryFromKeywords:keywords];
    if (keywords.count > 0) {
        [[PiPManager sharedManager] updateLine1:@"关键词" line2:[self.keywordsView.text substringToIndex:MIN(self.keywordsView.text.length, 32)]];
        NSLog(@"[Keywords] %@", self.keywordsView.text);
    }
}

- (void)extractScreenText {
    [[ScreenTextExtractor sharedExtractor] extractLatestScreenTextWithCompletion:^(NSString * _Nullable text, NSError * _Nullable error) {
        dispatch_async(dispatch_get_main_queue(), ^{
            if (error != nil) {
                NSLog(@"[OCR] error: %@", error);
                return;
            }
            if (text.length > 0) {
                NSLog(@"[OCR] %@", text);
                NSString *snippet = text.length > 36 ? [text substringToIndex:36] : text;
                [[PiPManager sharedManager] updateLine1:@"OCR" line2:snippet];
            }
        });
    }];
}

#pragma mark - Broadcast Log

- (void)showBroadcastLog {
    NSURL *logURL = [[SharedStorage sharedContainerURL] URLByAppendingPathComponent:@"broadcast.log"];
    NSData *data = [NSData dataWithContentsOfURL:logURL];
    if (data == nil) {
        self.statusLabel.text = @"状态：未找到录屏日志";
        return;
    }
    NSString *logText = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
    self.transcriptView.text = logText ?: @"";
    self.statusLabel.text = @"状态：已加载录屏日志";
}

#pragma mark - Live OCR

- (void)startLiveOCRPolling {
    self.ocrTimer = [NSTimer scheduledTimerWithTimeInterval:1.0 target:self selector:@selector(pollLiveOCR) userInfo:nil repeats:YES];
}

- (void)pollLiveOCR {
    NSURL *fileURL = [SharedStorage liveOCRFileURL];
    NSData *data = [NSData dataWithContentsOfURL:fileURL];
    if (data == nil) {
        return;
    }
    id json = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
    if (![json isKindOfClass:[NSDictionary class]]) {
        return;
    }
    NSDictionary *dict = (NSDictionary *)json;
    NSString *speaker = dict[@"speaker"] ?: @"";
    NSString *text = dict[@"text"] ?: @"";
    if (speaker.length == 0 && text.length == 0) {
        return;
    }
    if ([speaker isEqualToString:self.lastOCRSpeaker] && [text isEqualToString:self.lastOCRText]) {
        return;
    }
    self.lastOCRSpeaker = speaker;
    self.lastOCRText = text;
    NSLog(@"[OCR-RT] %@ %@", speaker, text);
    NSString *line1 = speaker.length > 0 ? speaker : @"OCR";
    NSString *snippet = text.length > 28 ? [text substringToIndex:28] : text;
    [[PiPManager sharedManager] updateLine1:line1 line2:snippet];
}

@end
