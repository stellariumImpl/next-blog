export type AudioTrack = {
  id: string;
  title: string;
  artist: string;
  src: string;
  cover?: string;
  description?: string;
};

// Bridge-Over-Troubled-Water-Simon&Garfunkel.mp3
// Gasshow-illion.mp3
// Lemon-米津玄師.mp3
// Pretender-Official髭男dism.mp3
// イエスタデイ-Official髭男dism.mp3
// 十面埋伏-陈奕迅.mp3
// 夕焼けの歌-近藤真彦.mp3
// 孤独患者-陈奕迅.mp3
// 青い栞-Galileo-Galilei.mp3

// 留住我吧-太极.mp3
// Wonderwall-Oasis.mp3
// Setting-Sun-Live-Radio-Broadcast-Oasis.mp3
// With-or-without-you-U2.mp3
// 1234567-方大同.mp3
// Beautiful-Day-U2.mp3
// Desperado-Eagles.mp3
// Dont-Look-Back-in-Anger-Oasis.mp3
// Ramblin-Man-The-Allman-Brothers-band.mp3
// Dancehall-Tribes#1ALO5.mp3

export const audioPlaylist: AudioTrack[] = [
  {
    id: "dancehall-tribes-1-alo5",
    title: "Dancehall",
    artist: "Tribes",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Dancehall-Tribes.mp3",
  },
  {
    id: "dont-look-back-in-anger-oasis",
    title: "Don't Look Back in Anger",
    artist: "Oasis",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Dont-Look-Back-in-Anger-Oasis.mp3",
  },
  {
    id: "desperado-eagles",
    title: "Desperado",
    artist: "Eagles",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Desperado-Eagles.mp3",
  },
  {
    id: "beautiful-day-u2",
    title: "Beautiful Day",
    artist: "U2",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Beautiful-Day-U2.mp3",
  },
  {
    id: "1234567-方大同",
    title: "1234567",
    artist: "方大同",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/1234567-方大同.mp3",
  },
  {
    id: "ramblin-man-the-allman-brothers-band",
    title: "Ramblin' Man",
    artist: "The Allman Brothers Band",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Ramblin-Man-The-Allman-Brothers-band.mp3",
  },
  {
    id: "with-or-without-you-u2",
    title: "With or Without You",
    artist: "U2",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/With-or-without-you-U2.mp3",
  },
  {
    id: "setting-sun",
    title: "Setting Sun",
    artist: "Oasis",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Setting-Sun-Live-Radio-Broadcast-Oasis.mp3",
  },
  {
    id: "liu-zhu-wo-ba",
    title: "留住我吧",
    artist: "太极",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/留住我吧-太极.mp3",
  },
  {
    id: "wonderwall-oasis",
    title: "Wonderwall",
    artist: "Oasis",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Wonderwall-Oasis.mp3",
  },
  {
    id: "blue-shiori",
    title: "青い栞",
    artist: "Galileo Galilei",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/青い栞-Galileo-Galilei.mp3",
  },
  {
    id: "gou-du-zheng-xin",
    title: "孤独患者",
    artist: "陈奕迅",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/孤独患者-陈奕迅.mp3",
  },
  {
    id: "yi-ya-ke-de-yue",
    title: "夕焼けの歌",
    artist: "近藤真彦",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/夕焼けの歌-近藤真彦.mp3",
  },
  {
    id: "shi-mian-mei-fu",
    title: "十面埋伏",
    artist: "陈奕迅",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/十面埋伏-陈奕迅.mp3",
  },
  {
    id: "yi-shi-dai-official髭男dism",
    title: "イエスタデイ",
    artist: "Official髭男dism",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/イエスタデイ-Official髭男dism.mp3",
  },
  {
    id: "pretender-official髭男dism",
    title: "Pretender",
    artist: "Official髭男dism",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Pretender-Official髭男dism.mp3",
  },
  {
    id: "lemon-米津玄師",
    title: "Lemon",
    artist: "米津玄師",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Lemon-米津玄師.mp3",
  },
  {
    id: "gasshow-illion",
    title: "Gasshow",
    artist: "illion",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Gasshow-illion.mp3",
  },
  {
    id: "bridge-over-troubled-water",
    title: "Bridge Over Troubled Water",
    artist: "Simon & Garfunkel",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Bridge-Over-Troubled-Water-Simon&Garfunkel.mp3",
  },
  {
    id: "never-enough",
    title: "Never Enough",
    artist: "Loren Allred",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Never-Enough-Loren-Allred.mp3",
  },
  {
    id: "sundaland-on-mind",
    title: "Sundaland on mind",
    artist: "tokyo blue weeps",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Sundaland-on-mind-tokyo-blue-weeps.mp3",
  },
  // {
  //   id: "sherman-from-corduroy-road-official-audio",
  //   title: "Sherman (From Corduroy Road) (OFFICIAL AUDIO)",
  //   artist: "Adam Young",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Sherman.mp3",
  // },
  {
    id: "beautiful-goodbye",
    title: "Beautiful Goodbye",
    artist: "Maroon 5",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Beautiful-Goodbye.mp3",
  },
  {
    id: "fisher",
    title: "Fisher",
    artist: "Camel Power Club",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Camel-Power-Club-Fisher.mp3",
  },
  // {
  //   id: "celestial",
  //   title: "Celestial",
  //   artist: "Ed Sheeran",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Celestial-Ed-Sheeran.mp3",
  // },
  {
    id: "dancing-butterflies",
    title: "Dancing Butterflies",
    artist: "PM Artist Sessions Project.The New Asia Ensemble",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Dancing-Butterflies-PM-Artist-Sessions-Project-The-New-Asia-Ensemble.mp3",
  },
  {
    id: "don-t-stop-me-now",
    title: "Don.t Stop Me Now",
    artist: "Queen",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Don.t-Stop-Me-Now-Queen.mp3",
  },
  {
    id: "father-and-son",
    title: "Father and Son",
    artist: "Fly Project",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Father-and-Son-Fly-Project.mp3",
  },
  {
    id: "fifth-avenue",
    title: "Fifth Avenue",
    artist: "Walk Off The Earth",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Fifth-Avenue-Walk-Off-The-Earth.mp3",
  },
  // {
  //   id: "i-really-want-to-stay-at-your-house",
  //   title: "I Really Want to Stay at Your House",
  //   artist: "Cyberpunk",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/I-Really-Want-to-Stay-at-Your-House-Cyberpunk.mp3",
  // },
  {
    id: "i-see-fire",
    title: "I See Fire",
    artist: "Ed Sheeran",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/I-See-Fire-Ed-Sheeran.mp3",
  },
  {
    id: "jane-doe",
    title: "JANE DOE",
    artist: "米津玄師.宇多田ヒカル",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/JANE-DOE-米津玄師.宇多田ヒカル.mp3",
  },
  {
    id: "life-in-technicolor",
    title: "Life in Technicolor",
    artist: "Coldplay",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Life-in-Technicolor-Coldplay.mp3",
  },
  {
    id: "dear-my-home-town",
    title: "Dear my home town",
    artist: "泽野弘之",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Dear-my-home-town-泽野弘之.mp3",
  },
  // {
  //   id: "flower-blooming-in-japan",
  //   title: "花は咲く",
  //   artist: "日本群星",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/花は咲く日本群星.mp3",
  // },
  // {
  //   id: "space-oddity",
  //   title: "Space Oddity",
  //   artist: "David Bowie",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Space-Oddity-David-Bowie.mp3",
  // },
  {
    id: "the-ludlows",
    title: "The Ludlows",
    artist: "James Horner",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/The-Ludlows-James-Horner.mp3",
  },
  // {
  //   id: "uptown-girl",
  //   title: "Uptown Girl",
  //   artist: "Westlife",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Uptown-Girl-Westlife.mp3",
  // },
  {
    id: "we-happy-don-t-worry",
    title: "We Happy Don.t Worry",
    artist: "American Authors",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/We-Happy-Don.t-Worry-American-Authors.mp3",
  },
  {
    id: "you-make-my-dreams",
    title: "You Make My Dreams",
    artist: "Hall . Oates",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/You-Make-My-Dreams-Hall-Oates.mp3",
  },
  // {
  //   id: "never-meant",
  //   title: "Never Meant",
  //   artist: "American Football",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/Never-Meant-American-Football.mp3",
  // },
  // {
  //   id: "bliss",
  //   title: "bliss",
  //   artist: "milet",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/bliss-milet.mp3",
  // },
  // {
  //   id: "hua-hai",
  //   title: "花海",
  //   artist: "Jay Chou",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/hua-hai.mp3",
  // },
  {
    id: "to-ri-flower",
    title: "ドライフラワー",
    artist: "優里",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/ドライフラワー-優里.mp3",
  },
  // {
  //   id: "yi-lu-xiang-bei",
  //   title: "一路向北",
  //   artist: "Jay Chou",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/一路向北-周杰伦.mp3",
  // },
  {
    id: "bu-yao-shuo-hua",
    title: "不要说话",
    artist: "陈奕迅",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/不要说话-陈奕迅.mp3",
  },
  // {
  //   id: "shi-jie-di-yi-de-hua",
  //   title: "世界に一つだけの花",
  //   artist: "SMAP",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/世界に一つだけの花-SMAP.mp3",
  // },
  {
    id: "lan-ti-xu",
    title: "兰亭序",
    artist: "Jay Chou",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/兰亭序-周杰伦.mp3",
  },
  // {
  //   id: "zai-hui-shou",
  //   title: "再回首",
  //   artist: "姜育恒",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/再回首-姜育恒.mp3",
  // },
  {
    id: "qian-qian-shi-xie",
    title: "前前前世",
    artist: "RADWIMPS",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/前前前世-RADWIMPS.mp3",
  },
  {
    id: "yu-meng-jiang",
    title: "呂夢江",
    artist: "南青樂隊",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/呂夢江-南青樂隊.mp3",
  },
  {
    id: "ruo-ai",
    title: "如果爱",
    artist: "方大同",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/如果爱-方大同.mp3",
  },
  // {
  //   id: "dan-ci-xuan-qu",
  //   title: "弹词选曲.白蛇传.赏中秋",
  //   artist: "新乐府.Daniel Ho",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/弹词选曲.白蛇传.赏中秋-新乐府.Daniel.Ho.mp3",
  // },
  {
    id: "lian",
    title: "恋",
    artist: "星野源",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/恋-星野源.mp3",
  },
  // {
  //   id: "qingtian",
  //   title: "晴天",
  //   artist: "Jay Chou",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/晴天-周杰伦.mp3",
  // },
  {
    id: "yong-heng-de-hui-guang",
    title: "永恒的光辉.",
    artist: "徳永英明",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/永恒的光辉.-徳永英明.mp3",
  },
  {
    id: "su-zhou-he",
    title: "蘇州河",
    artist: "南青樂隊",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/蘇州河-南青樂隊.mp3",
  },
  {
    id: "track-38",
    title: "行将近",
    artist: "聲無哀樂SWAL",
    src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/行将近-聲無哀樂SWAL.mp3",
  },
  // {
  //   id: "qing-hua-ci",
  //   title: "青花瓷",
  //   artist: "Jay Chou",
  //   src: "https://raw.githubusercontent.com/stellariumImpl/blog-assets/master/audio/青花瓷-周杰伦.mp3",
  // },
];
