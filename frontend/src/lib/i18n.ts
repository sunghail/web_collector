import { create } from 'zustand';

/** Languages the settings screens can be shown in. */
export type Language = 'en' | 'ko';

const STORAGE_KEY = 'language';

const en = {
  // Settings dialog
  'settings.title': 'Settings',
  'settings.description': 'Changes apply right away and are saved on this device.',
  'settings.sections': 'Settings sections',
  'settings.language': 'Language',
  'tab.style': 'Web style',
  'tab.cards': 'Link cards',
  'tab.chat': 'Chat',
  'tab.app': 'App',
  preview: 'Preview',

  // Web style
  'style.mode': 'Mode',
  'style.modeLabel': 'Color mode',
  'style.light': 'Light',
  'style.dark': 'Dark',
  'style.system': 'System',
  'style.preset': 'Preset',
  'style.presetLabel': 'Style preset',
  'preset.default': 'Default',
  'preset.macos': 'macOS',
  'preset.notion': 'Notion',
  'preset.glass': 'Glass',
  'preset.dashboard': 'Dashboard',
  'preset.custom': 'Custom',
  'preset.customTitle': 'Your own colors and corners',
  'style.customize': 'Customize',
  'style.customizeHint': 'Any change switches to Custom',
  'style.basedOn': 'Based on {name}',
  'style.resetTo': 'Reset to {name}',
  'style.corners': 'Corners',
  'style.square': 'Square',
  'style.shadows': 'Shadows',
  'shadow.none': 'None',
  'shadow.soft': 'Soft',
  'shadow.strong': 'Strong',
  'style.colorsLight': 'Colors for light mode · switch the mode above to edit the other one',
  'style.colorsDark': 'Colors for dark mode · switch the mode above to edit the other one',
  'palette.background': 'Page background',
  'palette.sidebar': 'Sidebar',
  'palette.card': 'Cards & dialogs',
  'palette.border': 'Borders',
  'palette.text': 'Text',
  'style.accent': 'Accent',
  'style.accentLabel': 'Accent color',
  'accent.blue': 'Blue',
  'accent.graphite': 'Graphite',
  'accent.green': 'Green',
  'accent.orange': 'Orange',
  'accent.violet': 'Violet',
  'accent.rose': 'Rose',
  'accent.custom': 'Pick your own color',

  // Link cards
  'cards.shape': 'Shape',
  'cards.compact': 'Compact',
  'cards.compactHint': 'One row per link',
  'cards.tile': 'Tile',
  'cards.tileHint': 'Icon above the title',
  'cards.size': 'Size',
  'cards.height': 'Card height',
  'cards.animation': 'Animation',
  'cards.animationHint': 'Point at one to preview it',
  'effect.lift': 'Lift',
  'effect.liftHint': 'Raises slightly',
  'effect.bar': 'Accent bar',
  'effect.barHint': 'Bar sweeps in, title colors',
  'effect.title': 'Accent title',
  'effect.titleHint': 'Title only',
  'effect.none': 'None',
  'effect.noneHint': 'Shadow only',
  'cards.reset': 'Reset link cards',

  // Chat
  'chat.textSize': 'Text size',
  'chat.textSizeHint': 'Or Ctrl + mouse wheel in a chat',
  'chat.font': 'Font',
  'font.default': 'Default',
  'font.defaultHint': 'Same as the app',
  'font.rounded': 'Rounded',
  'font.roundedHint': 'Soft and friendly',
  'font.serif': 'Serif',
  'font.serifHint': 'Like a book',
  'font.pen': 'Handwriting',
  'font.penHint': 'Written by pen',
  'font.mono': 'Monospace',
  'font.monoHint': 'Even letter widths',
  'chat.textColor': 'Text color',
  'chat.textColorHint': 'Message text only',
  'chat.colorDefault': 'Default',
  'chat.colorDefaultTitle': 'Follow the theme',
  'chat.readable': 'Check that it is readable in both light and dark mode.',
  'chat.reset': 'Reset chat text',
  'chatPreview.first': 'Morning! Found a great site for reading papers.',
  'chatPreview.second': 'Nice, send it over 👀',
  'chatPreview.you': 'you',

  // App: notifications
  'notify.title': 'Notifications',
  'notify.hint': 'Saved on this device',
  'notify.main': 'Message notifications',
  'notify.mainHint': 'A pop-up in the corner of the screen when a new message arrives.',
  'notify.direct': 'Direct messages',
  'notify.directHint': '1:1 chats with a friend',
  'notify.groups': 'Group rooms',
  'notify.groupsHint': 'Every new message in your rooms',
  'notify.mentions': 'Mentions',
  'notify.mentionsHint': 'When someone writes your @ID, also in Community',
  'notify.sound': 'Sound',
  'notify.soundHint': 'Play the system notification sound',
  'notify.preview': 'Show message text',
  'notify.previewHint': 'Off shows only “New message”',
  'notify.unsupported': 'This browser cannot show notifications.',
  'notify.denied': "Notifications are blocked for this site. Allow them in the browser's site settings (the icon left of the address), then reload.",
  'notify.ask': 'Your browser needs your OK before it can show them.',
  'notify.allow': 'Allow',
  'notify.test': 'Send a test',
  'notify.on': 'Notifications are on',
  'notify.testFailed': 'This browser could not show a notification',

  // App: desktop app, updates, keyboard
  'app.desktop': 'Desktop app',
  'app.desktopHint': 'Tray icon, floating category widgets and automatic updates. Same account as this website.',
  'app.updates': 'Updates',
  'app.version': 'Version {version}',
  'update.check': 'Check for updates',
  'update.checking': 'Checking',
  'update.download': 'Download',
  'update.restart': 'Restart to install',
  'update.downloadCheck': 'Download check',
  'update.applyInstaller': 'Apply installer',
  'update.ready': 'Ready',
  'update.waiting': 'Waiting',
  'update.msg.idle': 'Check for updates.',
  'update.msg.checking': 'Checking for updates.',
  'update.msg.latest': 'You are using the latest version.',
  'update.msg.available': 'A new version is available ({version}).',
  'update.msg.openedPage': 'Opened the download page in your browser.',
  'update.msg.downloading': 'Downloading update. {percent}%',
  'update.msg.downloaded': 'The new version has been downloaded ({version}).',
  'update.msg.restarting': 'Restarting to install the update.',
  'update.msg.unsupported': 'Updates are available only in the installed desktop app.',
  'update.msg.error': 'The update did not work: {detail}',
  'app.keyboard': 'Keyboard',
  'key.quickOpen': 'Quick open: find a link or a place',
  'key.search': 'Search links',
  'key.clearSearch': 'Clear search',
};

export type MessageKey = keyof typeof en;

const ko: Record<MessageKey, string> = {
  'settings.title': '설정',
  'settings.description': '바꾸면 바로 적용되고, 이 기기에 저장됩니다.',
  'settings.sections': '설정 항목',
  'settings.language': '언어',
  'tab.style': '화면 스타일',
  'tab.cards': '링크 카드',
  'tab.chat': '채팅',
  'tab.app': '앱',
  preview: '미리보기',

  'style.mode': '화면 모드',
  'style.modeLabel': '화면 모드',
  'style.light': '밝게',
  'style.dark': '어둡게',
  'style.system': '시스템 설정',
  'style.preset': '프리셋',
  'style.presetLabel': '스타일 프리셋',
  'preset.default': '기본',
  'preset.macos': 'macOS',
  'preset.notion': 'Notion',
  'preset.glass': '글래스',
  'preset.dashboard': '대시보드',
  'preset.custom': '직접 설정',
  'preset.customTitle': '내가 고른 색과 모서리',
  'style.customize': '세부 설정',
  'style.customizeHint': "바꾸면 '직접 설정'이 됩니다",
  'style.basedOn': '',
  'style.resetTo': '{name}{ro} 되돌리기',
  'style.corners': '모서리 둥글기',
  'style.square': '각지게',
  'style.shadows': '그림자',
  'shadow.none': '없음',
  'shadow.soft': '부드럽게',
  'shadow.strong': '진하게',
  'style.colorsLight': '밝은 모드 색상 · 어두운 모드 색은 위에서 모드를 바꿔 편집할 수 있습니다',
  'style.colorsDark': '어두운 모드 색상 · 밝은 모드 색은 위에서 모드를 바꿔 편집할 수 있습니다',
  'palette.background': '페이지 배경',
  'palette.sidebar': '사이드바',
  'palette.card': '카드·창',
  'palette.border': '테두리',
  'palette.text': '글자',
  'style.accent': '강조 색',
  'style.accentLabel': '강조 색',
  'accent.blue': '파랑',
  'accent.graphite': '그래파이트',
  'accent.green': '초록',
  'accent.orange': '주황',
  'accent.violet': '보라',
  'accent.rose': '로즈',
  'accent.custom': '원하는 색 고르기',

  'cards.shape': '모양',
  'cards.compact': '한 줄형',
  'cards.compactHint': '링크를 한 줄로',
  'cards.tile': '타일형',
  'cards.tileHint': '아이콘이 제목 위에',
  'cards.size': '크기',
  'cards.height': '카드 높이',
  'cards.animation': '마우스 효과',
  'cards.animationHint': '마우스를 올리면 미리 볼 수 있습니다',
  'effect.lift': '떠오르기',
  'effect.liftHint': '살짝 위로 뜹니다',
  'effect.bar': '강조 막대',
  'effect.barHint': '아래 막대가 채워지고 제목에 색',
  'effect.title': '제목 강조',
  'effect.titleHint': '제목에만 색',
  'effect.none': '없음',
  'effect.noneHint': '그림자만',
  'cards.reset': '링크 카드 되돌리기',

  'chat.textSize': '글자 크기',
  'chat.textSizeHint': '채팅에서 Ctrl + 마우스 휠로도 바꿀 수 있습니다',
  'chat.font': '글씨체',
  'font.default': '기본',
  'font.defaultHint': '앱과 같게',
  'font.rounded': '둥근체',
  'font.roundedHint': '부드럽고 친근하게',
  'font.serif': '명조',
  'font.serifHint': '책처럼',
  'font.pen': '손글씨',
  'font.penHint': '펜으로 쓴 듯',
  'font.mono': '고정폭',
  'font.monoHint': '글자 폭이 같게',
  'chat.textColor': '글자 색',
  'chat.textColorHint': '메시지 본문에만',
  'chat.colorDefault': '기본',
  'chat.colorDefaultTitle': '테마 색을 따릅니다',
  'chat.readable': '밝은 모드와 어두운 모드에서 모두 잘 보이는지 확인해 주세요.',
  'chat.reset': '채팅 글자 되돌리기',
  'chatPreview.first': '좋은 아침이에요! 논문 읽기 좋은 사이트를 찾았어요.',
  'chatPreview.second': '오 좋아요, 보내 주세요 👀',
  'chatPreview.you': '나',

  'notify.title': '알림',
  'notify.hint': '이 기기에 저장',
  'notify.main': '메시지 알림',
  'notify.mainHint': '새 메시지가 오면 화면 구석에 알림을 띄웁니다.',
  'notify.direct': '개인 메시지',
  'notify.directHint': '친구와의 1:1 채팅',
  'notify.groups': '그룹 룸',
  'notify.groupsHint': '내 룸의 모든 새 메시지',
  'notify.mentions': '멘션',
  'notify.mentionsHint': '누군가 내 @아이디를 부를 때 (커뮤니티 포함)',
  'notify.sound': '소리',
  'notify.soundHint': '알림음을 재생합니다',
  'notify.preview': '메시지 내용 보기',
  'notify.previewHint': "끄면 '새 메시지'로만 표시합니다",
  'notify.unsupported': '이 브라우저는 알림을 표시할 수 없습니다.',
  'notify.denied': '이 사이트의 알림이 차단되어 있습니다. 주소창 왼쪽 아이콘의 사이트 설정에서 알림을 허용한 뒤 새로고침해 주세요.',
  'notify.ask': '브라우저가 알림을 허락해야 보낼 수 있습니다.',
  'notify.allow': '허용',
  'notify.test': '테스트 알림 보내기',
  'notify.on': '알림이 켜졌습니다',
  'notify.testFailed': '이 브라우저에서 알림을 표시하지 못했습니다',

  'app.desktop': '데스크톱 앱',
  'app.desktopHint': '트레이 아이콘, 카테고리 위젯, 자동 업데이트. 웹사이트와 같은 계정을 사용합니다.',
  'app.updates': '업데이트',
  'app.version': '버전 {version}',
  'update.check': '업데이트 확인',
  'update.checking': '확인 중',
  'update.download': '다운로드',
  'update.restart': '다시 시작해서 설치',
  'update.downloadCheck': '새 버전 확인',
  'update.applyInstaller': '설치 준비',
  'update.ready': '준비됨',
  'update.waiting': '대기 중',
  'update.msg.idle': '업데이트를 확인할 수 있습니다.',
  'update.msg.checking': '업데이트를 확인하는 중입니다.',
  'update.msg.latest': '최신 버전을 사용 중입니다.',
  'update.msg.available': '새 버전이 있습니다 ({version}).',
  'update.msg.openedPage': '브라우저에서 다운로드 페이지를 열었습니다.',
  'update.msg.downloading': '업데이트를 받는 중입니다. {percent}%',
  'update.msg.downloaded': '새 버전을 받았습니다 ({version}).',
  'update.msg.restarting': '업데이트를 설치하기 위해 다시 시작합니다.',
  'update.msg.unsupported': '업데이트는 설치한 데스크톱 앱에서만 할 수 있습니다.',
  'update.msg.error': '업데이트하지 못했습니다: {detail}',
  'app.keyboard': '단축키',
  'key.quickOpen': '빠른 열기: 링크나 화면 찾기',
  'key.search': '링크 검색',
  'key.clearSearch': '검색 지우기',
};

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, ko };

/** "으로" after a final consonant, otherwise "로" (ㄹ also takes "로"): 기본으로, 글래스로, macOS로. */
function roParticle(word: string) {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code >= 0 && code <= 11171) {
    const final = code % 28;
    return final === 0 || final === 8 ? '로' : '으로';
  }
  // Latin letters: read the way they sound in Korean (n, m, ng end in a consonant).
  return /[mnMN]$/.test(last) ? '으로' : '로';
}

function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en';
  return navigator.language?.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

interface LanguageState {
  language: Language;
  isHydrated: boolean;
  hydrate: () => void;
  setLanguage: (language: Language) => void;
}

/** The chosen language, saved on this device; starts from the computer's language. */
export const useLanguage = create<LanguageState>((set, get) => ({
  language: 'en',
  isHydrated: false,
  hydrate: () => {
    if (get().isHydrated) return;
    let language = detectLanguage();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'ko') language = saved;
    } catch {
      // Storage unavailable: use the computer's language.
    }
    set({ language, isHydrated: true });
  },
  setLanguage: (language) => {
    set({ language });
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Not remembered this time; the language still switches.
    }
  },
}));

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

/** t('style.resetTo', { name }) in the chosen language. {ro} adds the right Korean particle after {name}. */
export function useT(): Translate {
  const language = useLanguage((state) => state.language);
  return (key, values = {}) => {
    let text = dictionaries[language][key] ?? en[key];
    for (const [name, value] of Object.entries(values)) text = text.split(`{${name}}`).join(String(value));
    if (text.includes('{ro}')) text = text.replace('{ro}', roParticle(String(values.name ?? '')));
    return text;
  };
}
