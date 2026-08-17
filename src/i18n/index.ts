export type GameLanguage = 'ko' | 'ja' | 'en' | 'zh';

const STORAGE_KEY = 'chameleon-hunt-language';

type Dict = Record<string, string>;

const ja: Dict = {
  "위장 난이도": "擬態難易度",
  "위장 제작 기록": "擬態制作記録",
  "헌터 기록 공유": "ハンター記録を共有",
  "내 헌터 기록을 깨봐! Color Hunt에서 도전하기 👇": "このハンター記録を破れる？ Color Huntで挑戦してみて👇",
  "랜덤": "ランダム",
  "색의 나라": "色の国",
  "판타지 마을": "ファンタジー村",
  "컴퓨터 세상": "コンピューターの世界",
  "꿈의 나라": "夢の国",
  "미술관": "美術館",
  "놀이동산": "遊園地",
  "그래피티 세상": "グラフィティの世界",
  "방의 세상": "部屋の世界",
  "마네킹 세상": "マネキンの世界",
  "낙서 세상": "落書きの世界",
  "무지개 세상": "虹の世界",
  "게임 링크 복사": "ゲームリンクをコピー",
  "게임 링크를 복사했습니다!": "ゲームリンクをコピーしました！",
  "공유 앱에서 링크가 빠지면 자동 복사된 링크를 붙여넣어 주세요.": "共有アプリでリンクが消えた場合は、自動コピーされたリンクを貼り付けてください。",
  "내 위장 어때? Color Hunt에서 직접 해보기 👇": "この擬態どう？ Color Huntで遊んでみて👇",
  "공유 완료 · 게임 링크도 복사되어 있어요!": "共有完了 · ゲームリンクもコピー済みです！",
  "위장 제작 시간": "擬態制作タイム",
  "첫 붓질부터 기록": "最初の一筆から計測",
  "완성!": "完成！",
  "기록 이미지를 만들 수 없습니다.": "記録画像を作成できません。",
  "HIDER RECORD": "HIDER RECORD",
  "위장 완성!": "擬態完成！",
  "친구에게 내 위장을 보여주고 Color Hunt에 초대해보세요.": "友達に擬態を見せて、Color Huntに誘ってみましょう。",
  "이미지 + 게임 링크 공유": "画像＋ゲームリンクを共有",
  "이미지 저장": "画像を保存",
  "Color Hunt에서 만든 내 위장이에요!": "Color Huntで作った擬態です！",
  "이미지를 저장하고 게임 링크를 복사했습니다!": "画像を保存し、ゲームリンクをコピーしました！",
  "이미지를 저장했습니다.": "画像を保存しました。",
  "핵어려움": "超激ムズ",
  "헌터 연습 시간": "ハンター練習時間",
  "시간별 TOP 5": "時間別 TOP 5",
  "아직 기록이 없습니다.": "まだ記録がありません。",
  "PRACTICE RESULT": "PRACTICE RESULT",
  "헌터 연습 성공!": "ハンター練習成功！",
  "연습 시간 종료": "練習時間終了",
  "모든 봇을 찾았습니다.": "すべてのBOTを発見しました。",
  "시간 안에 모든 봇을 찾지 못했습니다.": "時間内にすべてのBOTを見つけられませんでした。",
  "TOP 5": "TOP 5",
  "연습장으로 돌아가기": "練習場に戻る",
  "자유 연습 · 본게임과 같은 이동·색칠·확대·스포이드 조작을 연습해보세요.": "自由練習 · 本番と同じ移動・色塗り・ズーム・スポイト操作を練習できます。",
  "초보 추천": "初心者おすすめ",
  "연습장": "練習場",
  "BEGINNER PRACTICE": "BEGINNER PRACTICE",
  "처음이라면 여기서 헌터와 하이더를 연습해보세요": "初めてなら、ここでハンターとハイダーを練習できます",
  "연습할 맵": "練習するマップ",
  "헌터 연습": "ハンター練習",
  "봇 하이더들이 자동으로 위장하고 랜덤한 장소에 숨습니다. 찾아서 샷건으로 맞혀보세요!": "BOTハイダーが自動で擬態してランダムな場所に隠れます。見つけてショットガンで当てましょう！",
  "봇 하이더 수": "BOTハイダー数",
  "위장 정밀도": "擬態精度",
  "높을수록 봇의 색이 배경과 더 비슷해집니다.": "高いほどBOTの色が背景に近くなります。",
  "헌터 연습 시작": "ハンター練習を開始",
  "하이더 연습": "ハイダー練習",
  "헌터 없이 자유롭게 움직이며 색칠, 붓, 스포이드와 위장을 연습합니다.": "ハンターなしで自由に移動し、色塗り・ブラシ・スポイト・擬態を練習できます。",
  "하이더 연습 시작": "ハイダー練習を開始",
  "연습 종료": "練習終了",
  "BOT": "BOT",
  "연습 시작! 위장한 봇을 모두 찾아보세요.": "練習開始！擬態したBOTをすべて見つけましょう。",
  "자유 연습 · 원하는 만큼 움직이고 색칠해보세요.": "自由練習 · 好きなだけ動いて色を塗ってみましょう。",
  "연습 성공! 모든 봇을 찾았습니다. 연습 종료를 누르면 로비로 돌아갑니다.": "練習成功！すべてのBOTを発見しました。「練習終了」でロビーに戻れます。",
  "HUNTER 지원중":"HUNTER 志願中",
  "헌터 지원 완료":"ハンター志願済み",
  "헌터 지원 {count}명":"ハンター志願 {count}人",
  "게임 시작":"ゲーム開始",
  "게임 준비":"ゲーム準備",
  "내 캐릭터":"マイキャラクター",
  "대기방":"待機ルーム",
  "맵":"マップ",
  "도구":"ツール",
  "브러시":"ブラシ",
  "위장하세요":"擬態しよう",
  "숲의 맵":"森のマップ",
  "사막의 유적":"砂漠の遺跡",
  "바다의 리조트":"海のリゾート",
  "성의 정원":"城の庭園",
  "네온 시티":"ネオンシティ",
  "방 이름을 클릭하면 참가할 수 있어요!":"ルーム名をクリックすると参加できます！",
  "누구나 참여할 수 있는 방을 만들어요":"誰でも参加できるルームを作ります",
  "비밀번호를 설정해 방을 만들어요":"パスワード付きのルームを作ります",
  "초대코드를 입력해 방에 참여해요":"招待コードを入力して参加します",
  "카멜레온이 되어 색을 칠하고 헌터로부터 도망쳐 살아남아요!":"カメレオンになって色を塗り、ハンターから逃げて生き残ろう！",
  "Keyboard input is unavailable.":"キーボード入力は利用できません。",
  "♫ BGM ON":"♫ BGM ON",
  "♫ BGM OFF":"♫ BGM OFF",
  "MAP  RANDOM":"MAP  ランダム",
  "MULTI · CONNECTING...":"MULTI · 接続中...",
  "HIDE 0":"HIDE 0",
  "TIME 0":"TIME 0",
  "DOT CIRCLE":"ドット円",
  "SMOOTH CIRCLE":"滑らかな円",
  "SQUARE DOT":"四角ドット",
  "🌿 HIDER VICTORY":"🌿 HIDER 勝利",
  "🏆 HUNTER VICTORY":"🏆 HUNTER 勝利",
  "걸렸다!":"見つかった！",
  "대기실로 이동":"ロビーへ移動",
  "게임중":"ゲーム中",
  "서버 응답이 없어 로비로 돌아갑니다.":"サーバー応答がないためロビーに戻ります。",
  "준비 완료":"準備完了",
  "준비 취소":"準備取消",
  "바로 찾기 시작":"すぐに捜索開始",
  "하이더 준비 대기":"HIDER準備待ち",
  "시작!":"START!",
  "{name} 님이 연결을 종료했습니다.":"{name} さんが接続を終了しました。",
  "{name} 님이 재접속했습니다.":"{name} さんが再接続しました。",
  "연결이 불안정합니다. 재접속 중...":"接続が不安定です。再接続中...",
  "재접속했습니다.":"再接続しました。",

  "캐릭터 확대":"キャラ拡大",
  "브러시 크기":"ブラシサイズ",
  "휠: 확대/축소 · Ctrl+휠: 브러시 · 모바일: 두 손가락 확대":"ホイール: 拡大縮小 · Ctrl+ホイール: ブラシ · モバイル: 2本指ズーム",

  "이동":"移動",
  "조준":"照準",

  "찾았다!":"見つけた！",
  "HUNTER":"HUNTER",
  "하이더":"ハイダー",
  "헌터":"ハンター",

  "사냥 시간":"ハント時間",

  "내 캐릭터 꾸미기":"マイキャラを描く",
  "여기서 그린 모습은 대기실의 모든 플레이어에게 보입니다.":"ここで描いた見た目は待機室の全プレイヤーに表示されます。",
  "초기화":"リセット",
  "저장":"保存",
  "캐릭터 꾸미기를 저장했습니다.":"キャラクターの見た目を保存しました。",

  "터치  미리보기 · 움직이면 색칠":"タッチ  プレビュー · 動かすと塗る",

  "다시 실행":"やり直す",
  "한 단계 다시 실행했습니다.":"1つやり直しました。",
  "Ctrl+Y  한 단계 다시 실행":"Ctrl+Y  1段階やり直す",

  "헌터는 스포이드를 사용할 수 없습니다.":"HUNTERはスポイトを使用できません。",

  "TAB · 시야 전환":"TAB · 視点切替",

  "Shift+드래그  직선 그리기":"Shift+ドラッグ  直線を描く",
  "Ctrl+Z  한 단계 되돌리기":"Ctrl+Z  1段階元に戻す",
  "기본 색상 팔레트":"基本カラーパレット",
  "배경 위장색 + 검정/흰색 팔레트":"背景迷彩色 + 黒/白パレット",

  "두 손가락: 확대/축소":"2本指：拡大 / 縮小",
  "브러시 모양":"ブラシ形状",
  "원형":"円形",
  "사각형":"四角",
  "스포이드":"スポイト",
  "스포이드: 배경을 누른 채 움직이고 손을 떼면 색상이 선택됩니다":"スポイト：背景を押したまま動かし、指を離すと色を選択します",
  "스포이드: 배경에서 원하는 색을 클릭하세요":"スポイト：背景の取りたい色をクリックしてください",

  "시야 전환":"視点切替",
  "시야: 내 캐릭터":"視点：自分",
  "되돌리기":"元に戻す",
  "한 단계 되돌렸습니다.":"1つ前に戻しました。",

  "게임 시작하기":"ゲームを始める",
  "게임 설명":"ゲーム説明",
  "방장":"ルームオーナー",
  "색칠 시간":"ペイント時間",
  "인원":"人数",
  "상태":"状態",

  '위장하고, 숨고, 찾아내세요!':'擬態して、隠れて、見つけ出そう！',
  '방을 만드는 중...':'ルームを作成中...','플레이어 연결 중...':'プレイヤー接続中...','방을 만들지 못했습니다.':'ルームを作成できませんでした。',
  '방에 참가하는 중...':'ルームに参加中...','의상 로딩 중...':'衣装を読み込み中...','방에 참가할 수 없습니다. 이미 종료된 방일 수 있습니다.':'ルームに参加できません。すでに終了した可能性があります。',
  '방 ID 또는 비밀번호를 확인하세요.':'ルームIDまたはパスワードを確認してください。','방에 참가할 수 없습니다. 이미 사라진 방일 수 있습니다.':'ルームに参加できません。すでに削除された可能性があります。',
  '게임을 시작할 수 없습니다.':'ゲームを開始できません。','헌터의 총알이 모두 떨어졌습니다!':'ハンターの弾薬が尽きました！','게임을 계속할 수 없어 대기실로 돌아갑니다.':'ゲームを続行できないためロビーへ戻ります。',
  '헌터의 탄약이 모두 소진되었습니다. HIDER 승리!':'ハンターの弾薬が尽きました。HIDERの勝利！','서버 연결이 끊겼습니다. 메인 화면으로 돌아갑니다.':'サーバー接続が切れました。メイン画面に戻ります。',
  '초대 링크를 만들 수 없습니다.':'招待リンクを作成できません。','초대 링크를 복사했습니다!':'招待リンクをコピーしました！',
  '취소':'キャンセル','닉네임':'ニックネーム','방 이름':'ルーム名','비밀번호':'パスワード','비공개방 만들기':'非公開ルームを作成','공개방 만들기':'公開ルームを作成','만들기':'作成',
  '비공개방 참가':'非公開ルームに参加','방 ID':'ルームID','참가':'参加','초대받은 방 참가':'招待ルームに参加','게임방 참가':'ゲームルームに参加','초대 링크':'招待リンク','아래 링크를 복사하세요.':'下のリンクをコピーしてください。','닫기':'閉じる',
  '닉네임과 방 이름을 입력하세요.':'ニックネームとルーム名を入力してください。','비밀번호를 입력하세요.':'パスワードを入力してください。','방 정보와 닉네임을 확인하세요.':'ルーム情報とニックネームを確認してください。',
  '방을 확인하는 중...':'ルームを確認中...','이미 사라졌거나 참가할 수 없는 방입니다.':'すでに存在しないか参加できないルームです。','방에 참가할 수 없습니다. 방 목록을 갱신했습니다.':'ルームに参加できません。一覧を更新しました。',
  '내 플레이어':'自分','공개 게임방':'公開ゲームルーム','새로고침':'更新','방 목록을 불러오는 중...':'ルーム一覧を読み込み中...','생성된 공개방이 없습니다.':'公開ルームはありません。','방 목록을 불러오지 못했습니다.':'ルーム一覧を読み込めませんでした。',
  'HUNTER 지원':'HUNTER 希望','지원 취소':'希望を取消','HUNTER 지원 중':'HUNTER 希望中','초대 링크 복사':'招待リンクをコピー','로비로 나가기':'ロビーへ戻る',
  '당신은 방장입니다.':'あなたがルームオーナーです。','방장이 시작하기를 기다리는 중...':'ルームオーナーの開始を待っています...','WASD로 대기실 캐릭터 이동':'WASDでロビーのキャラクターを移動','방에서 나왔습니다.':'ルームから退出しました。',
  'HUNTER 승리!':'HUNTER 勝利！','HIDER 승리!':'HIDER 勝利！','게임 종료':'ゲーム終了','♥ 위험!':'♥ 危険！','♥ 두근두근':'♥ ドキドキ','♥ 두근':'♥ ドキ',
  'Hunter도 자신의 위장색을 칠해보세요.':'Hunterも自分の擬態色を塗ってみよう。','방장이 START GAME 버튼을 누르면 시작합니다.':'ルームオーナーがSTART GAMEを押すと開始します。',
  'HIDER 승리! 헌터의 탄약이 모두 소진되어 패배했습니다.':'HIDER 勝利！ハンターは弾薬を使い切りました。','HIDER 승리! 은신 위치를 공개합니다.':'HIDER 勝利！隠れていた場所を公開します。',
  '배경 대표색':'背景の代表色','이 맵에 실제 존재하는 색':'このマップに実際にある色','좌클릭  색칠':'左クリック  塗る','CAMO SWATCH  배경 대표색':'CAMO SWATCH  背景の代表色',
  '우클릭  스포이드':'右クリック  スポイト','우클릭  숨은 배경 추출 불가':'右クリック  隠れた背景は抽出不可','휠      확대 / 축소':'ホイール  拡大 / 縮小',
  'Ctrl+휠 브러시 크기':'Ctrl+ホイール ブラシサイズ','팔레트  브러시 모양':'パレット  ブラシ形状','B       모양 전환':'B       形状切替',
  '헌터는 숨겨진 배경을 스포이드할 수 없습니다. CAMO SWATCH를 사용하세요.':'ハンターは隠れた背景から色を取得できません。CAMO SWATCHを使ってください。',
  '휠: 확대/축소 · Ctrl+휠: 브러시 크기':'ホイール: 拡大/縮小 · Ctrl+ホイール: ブラシサイズ','배경 이미지를 읽을 수 없습니다':'背景画像を読み込めません',
  '탄약 소진 · 남은 시간 동안 수색하세요':'弾薬切れ · 残り時間は捜索してください','샷건이 과열되었습니다':'ショットガンがオーバーヒートしました','재장전 중입니다':'リロード中です',
  '탄약이 없습니다. R 버튼을 눌러서 장전하세요':'弾薬がありません。Rキーでリロードしてください','탄약 소진! R 키로 재장전':'弾薬切れ！Rキーでリロード','이미 재장전 중입니다':'すでにリロード中です','탄약이 이미 가득합니다':'弾薬は満タンです','재장전 중...':'リロード中...','재장전 완료!':'リロード完了！',
  '배경색을 골라 캐릭터를 위장하세요.':'背景色を選んでキャラクターを擬態させよう。','WASD 이동 · 마우스 조준 · 좌클릭 발사':'WASD 移動 · マウス照準 · 左クリック発射','WASD 이동':'WASD 移動',
  '모든 하이더를 발견했습니다 · 자동으로 대기실로 이동':'すべてのHIDERを発見 · 自動でロビーへ戻ります','모든 하이더를 찾았습니다!':'すべてのHIDERを見つけました！','시간 종료 · 자동으로 대기실로 이동':'時間切れ · 自動でロビーへ戻ります',
  'ROOM':'ルーム','TITLE':'タイトル','PLAYERS':'プレイヤー','현재 역할':'現在の役割','Hunter 지원':'Hunter 希望','시작 시 Hunter 수':'開始時 Hunter 数','MAP':'マップ',
  'START GAME':'ゲーム開始','FOR PLAYER':'プレイヤー待ち','ROUND OVER':'ラウンド終了','OVERHEAT!':'オーバーヒート！','MINIMAP':'ミニマップ',
  'COLOR PALETTE':'カラーパレット','CAMO SWATCH':'カモスウォッチ','PAINT CONTROLS':'ペイント操作','HEAT':'熱','RELOADING...':'リロード中...',
  'SHELLS':'弾薬','HIDERS':'HIDER','COLOR':'色','BRUSH':'ブラシ','PAINT':'ペイント','TIME':'時間','FOUND!':'発見！','SURVIVED':'生存',
  'HIDERS ARE PAINTING...':'HIDERがペイント中...','HUNTER VICTORY':'HUNTER 勝利','HIDER VICTORY':'HIDER 勝利','HUNTER WIN':'HUNTER 勝利','HIDERS WIN':'HIDER 勝利',
  '마우스 휠':'マウスホイール'
};

const en: Dict = {
  "위장 난이도": "Camo Difficulty",
  "위장 제작 기록": "Camouflage Time",
  "헌터 기록 공유": "Share Hunter Record",
  "내 헌터 기록을 깨봐! Color Hunt에서 도전하기 👇": "Can you beat my Hunter record? Try Color Hunt 👇",
  "랜덤": "Random",
  "색의 나라": "Land of Colors",
  "판타지 마을": "Fantasy Village",
  "컴퓨터 세상": "Computer World",
  "꿈의 나라": "Dreamland",
  "미술관": "Art Gallery",
  "놀이동산": "Amusement Park",
  "그래피티 세상": "Graffiti World",
  "방의 세상": "World of Rooms",
  "마네킹 세상": "Mannequin World",
  "낙서 세상": "Doodle World",
  "무지개 세상": "Rainbow World",
  "게임 링크 복사": "Copy Game Link",
  "게임 링크를 복사했습니다!": "Game link copied!",
  "공유 앱에서 링크가 빠지면 자동 복사된 링크를 붙여넣어 주세요.": "If the share app drops the link, paste the automatically copied game link.",
  "내 위장 어때? Color Hunt에서 직접 해보기 👇": "How's my camouflage? Try Color Hunt 👇",
  "공유 완료 · 게임 링크도 복사되어 있어요!": "Shared · the game link is copied too!",
  "위장 제작 시간": "Camouflage Time",
  "첫 붓질부터 기록": "Starts with first stroke",
  "완성!": "Done!",
  "기록 이미지를 만들 수 없습니다.": "Could not create the record image.",
  "HIDER RECORD": "HIDER RECORD",
  "위장 완성!": "Camouflage Complete!",
  "친구에게 내 위장을 보여주고 Color Hunt에 초대해보세요.": "Show your camouflage to friends and invite them to Color Hunt.",
  "이미지 + 게임 링크 공유": "Share Image + Game Link",
  "이미지 저장": "Save Image",
  "Color Hunt에서 만든 내 위장이에요!": "Here is my Color Hunt camouflage!",
  "이미지를 저장하고 게임 링크를 복사했습니다!": "Saved the image and copied the game link!",
  "이미지를 저장했습니다.": "Saved the image.",
  "핵어려움": "EXTREME",
  "헌터 연습 시간": "Hunter Practice Time",
  "시간별 TOP 5": "TOP 5 by Time",
  "아직 기록이 없습니다.": "No records yet.",
  "PRACTICE RESULT": "PRACTICE RESULT",
  "헌터 연습 성공!": "Hunter Practice Complete!",
  "연습 시간 종료": "Practice Time Up",
  "모든 봇을 찾았습니다.": "You found every bot.",
  "시간 안에 모든 봇을 찾지 못했습니다.": "You did not find every bot before time ran out.",
  "TOP 5": "TOP 5",
  "연습장으로 돌아가기": "Back to Practice Ground",
  "자유 연습 · 본게임과 같은 이동·색칠·확대·스포이드 조작을 연습해보세요.": "Free practice · train with the same movement, painting, zoom and eyedropper controls as a real match.",
  "초보 추천": "BEGINNER PICK",
  "연습장": "Practice Ground",
  "BEGINNER PRACTICE": "BEGINNER PRACTICE",
  "처음이라면 여기서 헌터와 하이더를 연습해보세요": "New here? Practice Hunter and Hider basics first",
  "연습할 맵": "Practice Map",
  "헌터 연습": "Hunter Practice",
  "봇 하이더들이 자동으로 위장하고 랜덤한 장소에 숨습니다. 찾아서 샷건으로 맞혀보세요!": "Bot Hiders camouflage themselves and hide at random spots. Find them and hit them with the shotgun!",
  "봇 하이더 수": "Bot Hiders",
  "위장 정밀도": "Camouflage Accuracy",
  "높을수록 봇의 색이 배경과 더 비슷해집니다.": "Higher values make bot colors match the background more closely.",
  "헌터 연습 시작": "Start Hunter Practice",
  "하이더 연습": "Hider Practice",
  "헌터 없이 자유롭게 움직이며 색칠, 붓, 스포이드와 위장을 연습합니다.": "Practice movement, painting, brushes, eyedropper and camouflage freely without a Hunter.",
  "하이더 연습 시작": "Start Hider Practice",
  "연습 종료": "Exit Practice",
  "BOT": "BOT",
  "연습 시작! 위장한 봇을 모두 찾아보세요.": "Practice started! Find every camouflaged bot.",
  "자유 연습 · 원하는 만큼 움직이고 색칠해보세요.": "Free practice · move and paint for as long as you like.",
  "연습 성공! 모든 봇을 찾았습니다. 연습 종료를 누르면 로비로 돌아갑니다.": "Practice complete! You found every bot. Press Exit Practice to return to the lobby.",
  "HUNTER 지원중":"HUNTER VOLUNTEERED",
  "헌터 지원 완료":"Hunter volunteer active",
  "헌터 지원 {count}명":"{count} hunter volunteer(s)",
  "게임 시작":"Start Game",
  "게임 준비":"Game Setup",
  "내 캐릭터":"My Character",
  "대기방":"Waiting Room",
  "맵":"Map",
  "도구":"Tools",
  "브러시":"Brush",
  "위장하세요":"Camouflage Yourself",
  "하이더":"Hider",
  "헌터":"Hunter",
  "숲의 맵":"Forest Map",
  "사막의 유적":"Desert Ruins",
  "바다의 리조트":"Ocean Resort",
  "성의 정원":"Castle Garden",
  "네온 시티":"Neon City",
  "방 이름을 클릭하면 참가할 수 있어요!":"Click a room name to join!",
  "누구나 참여할 수 있는 방을 만들어요":"Create a room anyone can join",
  "비밀번호를 설정해 방을 만들어요":"Create a password-protected room",
  "초대코드를 입력해 방에 참여해요":"Enter an invite code to join",
  "카멜레온이 되어 색을 칠하고 헌터로부터 도망쳐 살아남아요!":"Become a chameleon, paint your camouflage, and survive the hunters!",
  "Keyboard input is unavailable.":"Keyboard input is unavailable.",
  "♫ BGM ON":"♫ BGM ON",
  "♫ BGM OFF":"♫ BGM OFF",
  "MAP  RANDOM":"MAP  RANDOM",
  "MULTI · CONNECTING...":"MULTI · CONNECTING...",
  "HIDE 0":"HIDE 0",
  "TIME 0":"TIME 0",
  "DOT CIRCLE":"DOT CIRCLE",
  "SMOOTH CIRCLE":"SMOOTH CIRCLE",
  "SQUARE DOT":"SQUARE DOT",
  "CAMO SWATCH":"CAMO SWATCH",
  "COLOR PALETTE":"COLOR PALETTE",
  "FOUND!":"FOUND!",
  "HEAT":"HEAT",
  "HIDERS WIN":"HIDERS WIN",
  "HUNTER WIN":"HUNTER WIN",
  "MINIMAP":"MINIMAP",
  "OVERHEAT!":"OVERHEAT!",
  "RELOADING...":"RELOADING...",
  "ROUND OVER":"ROUND OVER",
  "START GAME":"START GAME",
  "SURVIVED":"SURVIVED",
  "🌿 HIDER VICTORY":"🌿 HIDER VICTORY",
  "🏆 HUNTER VICTORY":"🏆 HUNTER VICTORY",
  "걸렸다!":"FOUND!",
  "대기실로 이동":"Return to Lobby",
  "게임중":"IN GAME",
  "서버 응답이 없어 로비로 돌아갑니다.":"Server response timed out. Returning to the lobby.",
  "준비 완료":"READY",
  "준비 취소":"CANCEL READY",
  "바로 찾기 시작":"START HUNT NOW",
  "하이더 준비 대기":"WAITING FOR HIDERS",
  "시작!":"GO!",
  "{name} 님이 연결을 종료했습니다.":"{name} disconnected.",
  "{name} 님이 재접속했습니다.":"{name} reconnected.",
  "연결이 불안정합니다. 재접속 중...":"Connection unstable. Reconnecting...",
  "재접속했습니다.":"Reconnected.",

  "캐릭터 확대":"Character Zoom",
  "브러시 크기":"Brush Size",
  "휠: 확대/축소 · Ctrl+휠: 브러시 · 모바일: 두 손가락 확대":"Wheel: Zoom · Ctrl+Wheel: Brush · Mobile: Pinch Zoom",

  "이동":"MOVE",
  "조준":"AIM",

  "찾았다!":"FOUND!",
  "HIDER":"HIDER",
  "HUNTER":"HUNTER",

  "사냥 시간":"Hunt Time",

  "내 캐릭터 꾸미기":"Customize Character",
  "여기서 그린 모습은 대기실의 모든 플레이어에게 보입니다.":"Your drawing will be visible to everyone in the waiting room.",
  "초기화":"Reset",
  "저장":"Save",
  "캐릭터 꾸미기를 저장했습니다.":"Character customization saved.",

  "터치  미리보기 · 움직이면 색칠":"Touch  Preview · Move to paint",

  "다시 실행":"Redo",
  "한 단계 다시 실행했습니다.":"Redid one paint stroke.",
  "Ctrl+Y  한 단계 다시 실행":"Ctrl+Y  Redo one stroke",

  "헌터는 스포이드를 사용할 수 없습니다.":"Hunters cannot use the eyedropper.",

  "TAB · 시야 전환":"TAB · Switch View",

  "Shift+드래그  직선 그리기":"Shift+Drag  Draw straight line",
  "Ctrl+Z  한 단계 되돌리기":"Ctrl+Z  Undo one stroke",
  "기본 색상 팔레트":"Standard color palette",
  "배경 위장색 + 검정/흰색 팔레트":"Background camo + black/white palette",

  "두 손가락: 확대/축소":"Two fingers: Zoom in / out",
  "브러시 모양":"Brush Shape",
  "원형":"Circle",
  "사각형":"Square",
  "스포이드":"Eyedropper",
  "스포이드: 배경을 누른 채 움직이고 손을 떼면 색상이 선택됩니다":"Eyedropper: Hold and drag on the background, then release to pick the color",
  "스포이드: 배경에서 원하는 색을 클릭하세요":"Eyedropper: Click the background color you want to sample",

  "시야 전환":"Switch View",
  "시야: 내 캐릭터":"View: Self",
  "되돌리기":"Undo",
  "한 단계 되돌렸습니다.":"Undid one paint stroke.",

  "게임 시작하기":"Start Playing",
  "게임 설명":"How to Play",
  "방장":"ROOM OWNER",
  "색칠 시간":"Paint Time",
  "인원":"Players",
  "상태":"Status",

  '위장하고, 숨고, 찾아내세요!':'Camouflage, hide, and hunt!','방을 만드는 중...':'Creating room...','플레이어 연결 중...':'Connecting player...','방을 만들지 못했습니다.':'Could not create room.',
  '방에 참가하는 중...':'Joining room...','의상 로딩 중...':'Loading outfits...','방에 참가할 수 없습니다. 이미 종료된 방일 수 있습니다.':'Unable to join. The room may have ended.','방 ID 또는 비밀번호를 확인하세요.':'Check the room ID or password.','방에 참가할 수 없습니다. 이미 사라진 방일 수 있습니다.':'Unable to join. The room may no longer exist.',
  '게임을 시작할 수 없습니다.':'Unable to start the game.','헌터의 총알이 모두 떨어졌습니다!':'Hunters are out of ammo!','게임을 계속할 수 없어 대기실로 돌아갑니다.':'The round cannot continue. Returning to the lobby.',
  '헌터의 탄약이 모두 소진되었습니다. HIDER 승리!':'Hunters are out of ammo. HIDER wins!','서버 연결이 끊겼습니다. 메인 화면으로 돌아갑니다.':'Server disconnected. Returning to the main menu.',
  '초대 링크를 만들 수 없습니다.':'Could not create an invite link.','초대 링크를 복사했습니다!':'Invite link copied!','취소':'Cancel','닉네임':'Nickname','방 이름':'Room name','비밀번호':'Password',
  '비공개방 만들기':'Create Private Room','공개방 만들기':'Create Public Room','만들기':'Create','비공개방 참가':'Join Private Room','방 ID':'Room ID','참가':'Join','초대받은 방 참가':'Join Invited Room','게임방 참가':'Join Game Room','초대 링크':'Invite Link','아래 링크를 복사하세요.':'Copy the link below.','닫기':'Close',
  '닉네임과 방 이름을 입력하세요.':'Enter a nickname and room name.','비밀번호를 입력하세요.':'Enter the password.','방 정보와 닉네임을 확인하세요.':'Check the room information and nickname.','방을 확인하는 중...':'Checking room...',
  '이미 사라졌거나 참가할 수 없는 방입니다.':'This room no longer exists or cannot be joined.','방에 참가할 수 없습니다. 방 목록을 갱신했습니다.':'Unable to join. Room list refreshed.','내 플레이어':'You',
  '공개 게임방':'Public Rooms','새로고침':'Refresh','방 목록을 불러오는 중...':'Loading rooms...','생성된 공개방이 없습니다.':'No public rooms available.','방 목록을 불러오지 못했습니다.':'Could not load rooms.',
  'HUNTER 지원':'Volunteer as HUNTER','지원 취소':'Cancel Volunteer','HUNTER 지원 중':'HUNTER Volunteer','초대 링크 복사':'Copy Invite Link','로비로 나가기':'Leave Room','당신은 방장입니다.':'You are the room owner.',
  '방장이 시작하기를 기다리는 중...':'Waiting for the room owner to start...','WASD로 대기실 캐릭터 이동':'Move in the lobby with WASD','방에서 나왔습니다.':'You left the room.','HUNTER 승리!':'HUNTER WINS!','HIDER 승리!':'HIDER WINS!','게임 종료':'GAME OVER',
  '♥ 위험!':'♥ DANGER!','♥ 두근두근':'♥ HEARTBEAT','♥ 두근':'♥ BEAT','Hunter도 자신의 위장색을 칠해보세요.':'Hunters can paint their own camouflage too.','방장이 START GAME 버튼을 누르면 시작합니다.':'The game starts when the room owner presses START GAME.',
  'HIDER 승리! 헌터의 탄약이 모두 소진되어 패배했습니다.':'HIDER WINS! The hunters ran out of ammunition.','HIDER 승리! 은신 위치를 공개합니다.':'HIDER WINS! Revealing hiding positions.',
  '배경 대표색':'Background colors','이 맵에 실제 존재하는 색':'Colors sampled from this map','좌클릭  색칠':'Left click  Paint','CAMO SWATCH  배경 대표색':'CAMO SWATCH  Background colors','우클릭  스포이드':'Right click  Eyedropper',
  '우클릭  숨은 배경 추출 불가':'Right click  Hidden background unavailable','휠      확대 / 축소':'Wheel      Zoom','Ctrl+휠 브러시 크기':'Ctrl+Wheel Brush size','팔레트  브러시 모양':'Palette    Brush shape','B       모양 전환':'B          Change shape',
  '헌터는 숨겨진 배경을 스포이드할 수 없습니다. CAMO SWATCH를 사용하세요.':'Hunters cannot sample the hidden background. Use CAMO SWATCH.','휠: 확대/축소 · Ctrl+휠: 브러시 크기':'Wheel: Zoom · Ctrl+Wheel: Brush size',
  '배경 이미지를 읽을 수 없습니다':'Unable to read background image','탄약 소진 · 남은 시간 동안 수색하세요':'Out of ammo · Search for the remaining time','샷건이 과열되었습니다':'Shotgun overheated','재장전 중입니다':'Reloading',
  '탄약이 없습니다. R 버튼을 눌러서 장전하세요':'No ammo. Press R to reload','탄약 소진! R 키로 재장전':'Out of ammo! Press R to reload','이미 재장전 중입니다':'Already reloading','탄약이 이미 가득합니다':'Ammo is already full','재장전 중...':'Reloading...','재장전 완료!':'Reload complete!',
  '배경색을 골라 캐릭터를 위장하세요.':'Choose background colors to camouflage your character.','WASD 이동 · 마우스 조준 · 좌클릭 발사':'WASD Move · Mouse Aim · Left Click Shoot','WASD 이동':'WASD Move',
  '모든 하이더를 발견했습니다 · 자동으로 대기실로 이동':'All Hiders found · Returning to lobby automatically','모든 하이더를 찾았습니다!':'All Hiders found!','시간 종료 · 자동으로 대기실로 이동':'Time is up · Returning to lobby automatically',
  '현재 역할':'CURRENT ROLE','Hunter 지원':'HUNTER SUPPORT','시작 시 Hunter 수':'HUNTERS AT START','FOR PLAYER':'WAITING FOR PLAYER','마우스 휠':'Mouse wheel'
};

const zh: Dict = {
  "위장 난이도": "伪装难度",
  "위장 제작 기록": "伪装制作记录",
  "헌터 기록 공유": "分享猎人记录",
  "내 헌터 기록을 깨봐! Color Hunt에서 도전하기 👇": "能打破我的猎人记录吗？来挑战 Color Hunt 👇",
  "랜덤": "随机",
  "색의 나라": "色彩之国",
  "판타지 마을": "幻想村庄",
  "컴퓨터 세상": "电脑世界",
  "꿈의 나라": "梦之国",
  "미술관": "美术馆",
  "놀이동산": "游乐园",
  "그래피티 세상": "涂鸦世界",
  "방의 세상": "房间世界",
  "마네킹 세상": "人体模型世界",
  "낙서 세상": "涂鸦天地",
  "무지개 세상": "彩虹世界",
  "게임 링크 복사": "复制游戏链接",
  "게임 링크를 복사했습니다!": "游戏链接已复制！",
  "공유 앱에서 링크가 빠지면 자동 복사된 링크를 붙여넣어 주세요.": "如果分享应用没有附带链接，请粘贴已自动复制的游戏链接。",
  "내 위장 어때? Color Hunt에서 직접 해보기 👇": "我的伪装怎么样？来试试 Color Hunt 👇",
  "공유 완료 · 게임 링크도 복사되어 있어요!": "分享完成 · 游戏链接也已复制！",
  "위장 제작 시간": "伪装制作时间",
  "첫 붓질부터 기록": "从第一笔开始计时",
  "완성!": "完成！",
  "기록 이미지를 만들 수 없습니다.": "无法生成记录图片。",
  "HIDER RECORD": "HIDER RECORD",
  "위장 완성!": "伪装完成！",
  "친구에게 내 위장을 보여주고 Color Hunt에 초대해보세요.": "把你的伪装分享给朋友，并邀请他们来玩 Color Hunt。",
  "이미지 + 게임 링크 공유": "分享图片＋游戏链接",
  "이미지 저장": "保存图片",
  "Color Hunt에서 만든 내 위장이에요!": "这是我在 Color Hunt 做的伪装！",
  "이미지를 저장하고 게임 링크를 복사했습니다!": "图片已保存，游戏链接已复制！",
  "이미지를 저장했습니다.": "图片已保存。",
  "핵어려움": "地狱难度",
  "헌터 연습 시간": "猎人练习时间",
  "시간별 TOP 5": "按时间 TOP 5",
  "아직 기록이 없습니다.": "暂无记录。",
  "PRACTICE RESULT": "PRACTICE RESULT",
  "헌터 연습 성공!": "猎人练习成功！",
  "연습 시간 종료": "练习时间结束",
  "모든 봇을 찾았습니다.": "已找到所有机器人。",
  "시간 안에 모든 봇을 찾지 못했습니다.": "未能在时间内找到所有机器人。",
  "TOP 5": "TOP 5",
  "연습장으로 돌아가기": "返回练习场",
  "자유 연습 · 본게임과 같은 이동·색칠·확대·스포이드 조작을 연습해보세요.": "自由练习 · 使用与正式比赛相同的移动、涂色、缩放和吸管操作进行练习。",
  "초보 추천": "新手推荐",
  "연습장": "练习场",
  "BEGINNER PRACTICE": "BEGINNER PRACTICE",
  "처음이라면 여기서 헌터와 하이더를 연습해보세요": "第一次玩的话，可以先在这里练习猎人和躲藏者",
  "연습할 맵": "练习地图",
  "헌터 연습": "猎人练习",
  "봇 하이더들이 자동으로 위장하고 랜덤한 장소에 숨습니다. 찾아서 샷건으로 맞혀보세요!": "机器人躲藏者会自动伪装并随机藏起来。找到它们并用霰弹枪击中吧！",
  "봇 하이더 수": "机器人数量",
  "위장 정밀도": "伪装精度",
  "높을수록 봇의 색이 배경과 더 비슷해집니다.": "数值越高，机器人颜色越接近背景。",
  "헌터 연습 시작": "开始猎人练习",
  "하이더 연습": "躲藏者练习",
  "헌터 없이 자유롭게 움직이며 색칠, 붓, 스포이드와 위장을 연습합니다.": "没有猎人，可以自由练习移动、涂色、画笔、吸管和伪装。",
  "하이더 연습 시작": "开始躲藏者练习",
  "연습 종료": "结束练习",
  "BOT": "BOT",
  "연습 시작! 위장한 봇을 모두 찾아보세요.": "练习开始！找出所有伪装机器人。",
  "자유 연습 · 원하는 만큼 움직이고 색칠해보세요.": "自由练习 · 可以尽情移动和涂色。",
  "연습 성공! 모든 봇을 찾았습니다. 연습 종료를 누르면 로비로 돌아갑니다.": "练习成功！你找到了所有机器人。点击结束练习返回大厅。",
  "HUNTER 지원중":"已申请 HUNTER",
  "헌터 지원 완료":"已申请猎人",
  "헌터 지원 {count}명":"猎人申请 {count}人",
  "게임 시작":"开始游戏",
  "게임 준비":"游戏准备",
  "내 캐릭터":"我的角色",
  "대기방":"等待房间",
  "맵":"地图",
  "도구":"工具",
  "브러시":"画笔",
  "위장하세요":"进行伪装",
  "하이더":"躲藏者",
  "헌터":"猎人",
  "숲의 맵":"森林地图",
  "사막의 유적":"沙漠遗迹",
  "바다의 리조트":"海滨度假村",
  "성의 정원":"城堡花园",
  "네온 시티":"霓虹都市",
  "방 이름을 클릭하면 참가할 수 있어요!":"点击房间名称即可加入！",
  "누구나 참여할 수 있는 방을 만들어요":"创建任何人都能加入的房间",
  "비밀번호를 설정해 방을 만들어요":"创建带密码的房间",
  "초대코드를 입력해 방에 참여해요":"输入邀请码加入房间",
  "카멜레온이 되어 색을 칠하고 헌터로부터 도망쳐 살아남아요!":"化身变色龙涂上伪装色，躲避猎人并坚持到最后！",
  "♫ BGM ON":"♫ BGM 开",
  "♫ BGM OFF":"♫ BGM 关",
  "MAP  RANDOM":"地图  随机",
  "MULTI · CONNECTING...":"多人模式 · 连接中...",
  "HIDE 0":"隐藏 0",
  "걸렸다!":"被发现了！",
  "대기실로 이동":"返回大厅",
  "게임중":"游戏中",
  "서버 응답이 없어 로비로 돌아갑니다.":"服务器无响应，正在返回大厅。",
  "준비 완료":"准备完成",
  "준비 취소":"取消准备",
  "바로 찾기 시작":"立即开始搜寻",
  "하이더 준비 대기":"等待躲藏者准备",
  "시작!":"开始!",
  "{name} 님이 연결을 종료했습니다.":"{name} 已断开连接。",
  "{name} 님이 재접속했습니다.":"{name} 已重新连接。",
  "연결이 불안정합니다. 재접속 중...":"连接不稳定，正在重新连接...",
  "재접속했습니다.":"已重新连接。",

  "캐릭터 확대":"角色缩放",
  "브러시 크기":"画笔大小",
  "휠: 확대/축소 · Ctrl+휠: 브러시 · 모바일: 두 손가락 확대":"滚轮: 缩放 · Ctrl+滚轮: 画笔 · 手机: 双指缩放",

  "이동":"移动",
  "조준":"瞄准",

  "찾았다!":"找到了！",
  "HUNTER":"HUNTER",

  "사냥 시간":"狩猎时间",

  "내 캐릭터 꾸미기":"自定义角色",
  "여기서 그린 모습은 대기실의 모든 플레이어에게 보입니다.":"你在这里绘制的外观会显示给等待室中的所有玩家。",
  "초기화":"重置",
  "저장":"保存",
  "캐릭터 꾸미기를 저장했습니다.":"角色外观已保存。",

  "터치  미리보기 · 움직이면 색칠":"触摸  预览 · 移动后涂色",

  "다시 실행":"重做",
  "한 단계 다시 실행했습니다.":"已重做一步涂色。",
  "Ctrl+Y  한 단계 다시 실행":"Ctrl+Y  重做一步",

  "헌터는 스포이드를 사용할 수 없습니다.":"猎人无法使用吸管工具。",

  "TAB · 시야 전환":"TAB · 切换视角",

  "Shift+드래그  직선 그리기":"Shift+拖动  绘制直线",
  "Ctrl+Z  한 단계 되돌리기":"Ctrl+Z  撤销一步",
  "기본 색상 팔레트":"基础颜色调色板",
  "배경 위장색 + 검정/흰색 팔레트":"背景伪装色 + 黑/白调色板",

  "두 손가락: 확대/축소":"双指：放大 / 缩小",
  "브러시 모양":"画笔形状",
  "원형":"圆形",
  "사각형":"方形",
  "스포이드":"吸管",
  "스포이드: 배경을 누른 채 움직이고 손을 떼면 색상이 선택됩니다":"吸管：按住背景并拖动，松开手指即可选取颜色",
  "스포이드: 배경에서 원하는 색을 클릭하세요":"吸管：点击背景中想要取样的颜色",

  "시야 전환":"切换视角",
  "시야: 내 캐릭터":"视角：自己",
  "되돌리기":"撤销",
  "한 단계 되돌렸습니다.":"已撤销上一步涂色。",

  "게임 시작하기":"开始游戏",
  "게임 설명":"游戏说明",
  "방장":"房主",
  "색칠 시간":"涂色时间",
  "인원":"人数",
  "상태":"状态",

  '위장하고, 숨고, 찾아내세요!':'伪装、躲藏、寻找！','방을 만드는 중...':'正在创建房间...','플레이어 연결 중...':'正在连接玩家...','방을 만들지 못했습니다.':'无法创建房间。','방에 참가하는 중...':'正在加入房间...','의상 로딩 중...':'正在加载服装...',
  '방에 참가할 수 없습니다. 이미 종료된 방일 수 있습니다.':'无法加入房间，房间可能已经结束。','방 ID 또는 비밀번호를 확인하세요.':'请确认房间ID或密码。','방에 참가할 수 없습니다. 이미 사라진 방일 수 있습니다.':'无法加入房间，房间可能已不存在。',
  '게임을 시작할 수 없습니다.':'无法开始游戏。','헌터의 총알이 모두 떨어졌습니다!':'猎人弹药耗尽！','게임을 계속할 수 없어 대기실로 돌아갑니다.':'游戏无法继续，返回大厅。',
  '헌터의 탄약이 모두 소진되었습니다. HIDER 승리!':'猎人弹药耗尽。HIDER获胜！','서버 연결이 끊겼습니다. 메인 화면으로 돌아갑니다.':'服务器连接已断开，返回主界面。','초대 링크를 만들 수 없습니다.':'无法创建邀请链接。','초대 링크를 복사했습니다!':'邀请链接已复制！',
  '취소':'取消','닉네임':'昵称','방 이름':'房间名称','비밀번호':'密码','비공개방 만들기':'创建私人房间','공개방 만들기':'创建公开房间','만들기':'创建','비공개방 참가':'加入私人房间','방 ID':'房间ID','참가':'加入','초대받은 방 참가':'加入邀请房间','게임방 참가':'加入游戏房间','초대 링크':'邀请链接','아래 링크를 복사하세요.':'请复制下面的链接。','닫기':'关闭',
  '닉네임과 방 이름을 입력하세요.':'请输入昵称和房间名称。','비밀번호를 입력하세요.':'请输入密码。','방 정보와 닉네임을 확인하세요.':'请确认房间信息和昵称。','방을 확인하는 중...':'正在检查房间...','이미 사라졌거나 참가할 수 없는 방입니다.':'该房间已不存在或无法加入。','방에 참가할 수 없습니다. 방 목록을 갱신했습니다.':'无法加入房间，已刷新房间列表。','내 플레이어':'我',
  '공개 게임방':'公开游戏房间','새로고침':'刷新','방 목록을 불러오는 중...':'正在加载房间...','생성된 공개방이 없습니다.':'暂无公开房间。','방 목록을 불러오지 못했습니다.':'无法加载房间列表。',
  'HUNTER 지원':'申请成为HUNTER','지원 취소':'取消申请','HUNTER 지원 중':'已申请HUNTER','초대 링크 복사':'复制邀请链接','로비로 나가기':'离开房间','당신은 방장입니다.':'你是房主。','방장이 시작하기를 기다리는 중...':'等待房主开始游戏...','WASD로 대기실 캐릭터 이동':'使用WASD在大厅移动','방에서 나왔습니다.':'已离开房间。',
  'HUNTER 승리!':'HUNTER获胜！','HIDER 승리!':'HIDER获胜！','게임 종료':'游戏结束','♥ 위험!':'♥ 危险！','♥ 두근두근':'♥ 心跳加速','♥ 두근':'♥ 心跳','Hunter도 자신의 위장색을 칠해보세요.':'Hunter也可以涂上自己的伪装色。','방장이 START GAME 버튼을 누르면 시작합니다.':'房主按下START GAME后开始。',
  'HIDER 승리! 헌터의 탄약이 모두 소진되어 패배했습니다.':'HIDER获胜！猎人的弹药已全部耗尽。','HIDER 승리! 은신 위치를 공개합니다.':'HIDER获胜！显示隐藏位置。',
  '배경 대표색':'背景代表色','이 맵에 실제 존재하는 색':'此地图中实际存在的颜色','좌클릭  색칠':'左键  涂色','CAMO SWATCH  배경 대표색':'CAMO SWATCH  背景代表色','우클릭  스포이드':'右键  吸管','우클릭  숨은 배경 추출 불가':'右键  无法提取隐藏背景','휠      확대 / 축소':'滚轮      放大 / 缩小','Ctrl+휠 브러시 크기':'Ctrl+滚轮 画笔大小','팔레트  브러시 모양':'调色板  画笔形状','B       모양 전환':'B       切换形状',
  '헌터는 숨겨진 배경을 스포이드할 수 없습니다. CAMO SWATCH를 사용하세요.':'猎人无法从隐藏背景吸取颜色。请使用CAMO SWATCH。','휠: 확대/축소 · Ctrl+휠: 브러시 크기':'滚轮：缩放 · Ctrl+滚轮：画笔大小','배경 이미지를 읽을 수 없습니다':'无法读取背景图像',
  '탄약 소진 · 남은 시간 동안 수색하세요':'弹药耗尽 · 请在剩余时间继续搜索','샷건이 과열되었습니다':'霰弹枪过热','재장전 중입니다':'正在装弹','탄약이 없습니다. R 버튼을 눌러서 장전하세요':'没有弹药。按R键装弹','탄약 소진! R 키로 재장전':'弹药耗尽！按R键装弹','이미 재장전 중입니다':'正在装弹中','탄약이 이미 가득합니다':'弹药已满','재장전 중...':'正在装弹...','재장전 완료!':'装弹完成！',
  '배경색을 골라 캐릭터를 위장하세요.':'选择背景颜色来伪装角色。','WASD 이동 · 마우스 조준 · 좌클릭 발사':'WASD移动 · 鼠标瞄准 · 左键射击','WASD 이동':'WASD移动','모든 하이더를 발견했습니다 · 자동으로 대기실로 이동':'已找到所有HIDER · 自动返回大厅','모든 하이더를 찾았습니다!':'已找到所有HIDER！','시간 종료 · 자동으로 대기실로 이동':'时间结束 · 自动返回大厅',
  'ROOM':'房间','TITLE':'标题','PLAYERS':'玩家','현재 역할':'当前角色','Hunter 지원':'Hunter申请','시작 시 Hunter 수':'开始时Hunter数量','MAP':'地图','START GAME':'开始游戏','FOR PLAYER':'等待玩家',
  'ROUND OVER':'回合结束','OVERHEAT!':'过热！','MINIMAP':'小地图','COLOR PALETTE':'调色板','CAMO SWATCH':'伪装色板','PAINT CONTROLS':'涂色操作','HEAT':'热量','RELOADING...':'装弹中...',
  'SHELLS':'弹药','HIDERS':'HIDER','COLOR':'颜色','BRUSH':'画笔','PAINT':'涂色','TIME':'时间','FOUND!':'发现！','SURVIVED':'存活',
  'HIDERS ARE PAINTING...':'HIDER正在涂色...','HUNTER VICTORY':'HUNTER获胜','HIDER VICTORY':'HIDER获胜','HUNTER WIN':'HUNTER获胜','HIDERS WIN':'HIDER获胜','마우스 휠':'鼠标滚轮'
};

const ko: Dict = {
  "걸렸다!":"걸렸다!",
  "대기실로 이동":"대기실로 이동",
  "게임중":"게임중",
  "{name} 님이 연결을 종료했습니다.":"{name} 님이 연결을 종료했습니다.",
  "{name} 님이 재접속했습니다.":"{name} 님이 재접속했습니다.",
  "연결이 불안정합니다. 재접속 중...":"연결이 불안정합니다. 재접속 중...",
  "재접속했습니다.":"재접속했습니다.",

  "캐릭터 확대":"캐릭터 확대",
  "브러시 크기":"브러시 크기",
  "휠: 확대/축소 · Ctrl+휠: 브러시 · 모바일: 두 손가락 확대":"휠: 확대/축소 · Ctrl+휠: 브러시 · 모바일: 두 손가락 확대",

  "이동":"이동",
  "조준":"조준",

  "찾았다!":"찾았다!",
  "HUNTER":"HUNTER",

  "사냥 시간":"사냥 시간",

  "내 캐릭터 꾸미기":"내 캐릭터 꾸미기",
  "여기서 그린 모습은 대기실의 모든 플레이어에게 보입니다.":"여기서 그린 모습은 대기실의 모든 플레이어에게 보입니다.",
  "초기화":"초기화",
  "취소":"취소",
  "저장":"저장",
  "캐릭터 꾸미기를 저장했습니다.":"캐릭터 꾸미기를 저장했습니다.",

  "터치  미리보기 · 움직이면 색칠":"터치  미리보기 · 움직이면 색칠",

  "다시 실행":"다시 실행",
  "한 단계 다시 실행했습니다.":"한 단계 다시 실행했습니다.",
  "Ctrl+Y  한 단계 다시 실행":"Ctrl+Y  한 단계 다시 실행",

  "헌터는 스포이드를 사용할 수 없습니다.":"헌터는 스포이드를 사용할 수 없습니다.",

  "TAB · 시야 전환":"TAB · 시야 전환",

  "Shift+드래그  직선 그리기":"Shift+드래그  직선 그리기",
  "Ctrl+Z  한 단계 되돌리기":"Ctrl+Z  한 단계 되돌리기",
  "기본 색상 팔레트":"기본 색상 팔레트",
  "배경 위장색 + 검정/흰색 팔레트":"배경 위장색 + 검정/흰색 팔레트",

  "두 손가락: 확대/축소":"두 손가락: 확대/축소",
  "스포이드":"스포이드",
  "스포이드: 배경을 누른 채 움직이고 손을 떼면 색상이 선택됩니다":"스포이드: 배경을 누른 채 움직이고 손을 떼면 색상이 선택됩니다",
  "스포이드: 배경에서 원하는 색을 클릭하세요":"스포이드: 배경에서 원하는 색을 클릭하세요",

  "시야 전환":"시야 전환",
  "시야: 내 캐릭터":"시야: 내 캐릭터",
  "되돌리기":"되돌리기",
  "한 단계 되돌렸습니다.":"한 단계 되돌렸습니다.",

  "게임 시작하기":"게임 시작하기",
  "게임 설명":"게임 설명",
  "상태":"상태",

  '방장':'방장',
  '색칠 시간':'색칠 시간',
  '브러시 모양':'브러시 모양',
  '픽셀':'픽셀',
  '원형':'원형',
  '사각형':'사각형',
  'ON':'켜짐',
  'OFF':'꺼짐',
  'RANDOM':'랜덤',
  'Keyboard input is unavailable.':'키보드 입력을 사용할 수 없습니다.',
  'TIME 0':'시간 0',
  '🏆 HUNTER VICTORY':'🏆 HUNTER 승리',
  '🌿 HIDER VICTORY':'🌿 HIDER 승리',
  'DOT CIRCLE':'점 원형',
  'SMOOTH CIRCLE':'부드러운 원형',
  'SQUARE DOT':'사각 점',
  'ROOM':'방','TITLE':'방 이름','PLAYERS':'인원','현재 역할':'현재 역할','Hunter 지원':'Hunter 지원','시작 시 Hunter 수':'시작 시 Hunter 수','MAP':'맵',
  'START GAME':'게임 시작','FOR PLAYER':'플레이어 대기','ROUND OVER':'라운드 종료','OVERHEAT!':'과열!','MINIMAP':'미니맵',
  'COLOR PALETTE':'색상 팔레트','CAMO SWATCH':'위장 색상','PAINT CONTROLS':'색칠 조작','HEAT':'과열','RELOADING...':'재장전 중...',
  'SHELLS':'탄약','HIDERS':'HIDER','COLOR':'색상','BRUSH':'브러시','PAINT':'색칠','TIME':'시간','FOUND!':'발견!','SURVIVED':'생존',
  'HIDERS ARE PAINTING...':'HIDER가 색칠 중...','HUNTER VICTORY':'HUNTER 승리','HIDER VICTORY':'HIDER 승리','HUNTER WIN':'HUNTER 승리','HIDERS WIN':'HIDER 승리',
  '마우스 휠':'마우스 휠'
};

const dictionaries: Record<GameLanguage, Dict> = { ko, ja, en, zh };

function detectBrowserLanguage(): GameLanguage {
  const candidates =
    typeof navigator !== 'undefined'
      ? [
          ...(navigator.languages ?? []),
          navigator.language,
        ]
          .filter(Boolean)
          .map((value) => value.toLowerCase())
      : [];

  for (const value of candidates) {
    if (
      value.startsWith('ko')
    ) {
      return 'ko';
    }

    if (
      value.startsWith('ja')
    ) {
      return 'ja';
    }

    if (
      value.startsWith('zh')
    ) {
      return 'zh';
    }

    if (
      value.startsWith('en')
    ) {
      return 'en';
    }
  }

  return 'en';
}

export function getLanguage(): GameLanguage {
  const saved =
    localStorage.getItem(STORAGE_KEY);

  if (
    saved === 'ko' ||
    saved === 'ja' ||
    saved === 'en' ||
    saved === 'zh'
  ) {
    return saved;
  }

  return detectBrowserLanguage();
}

export function setLanguage(language: GameLanguage): void {
  localStorage.setItem(
    STORAGE_KEY,
    language,
  );
}

function dynamicTranslate(text: string, language: GameLanguage): string | undefined {
  const d = dictionaries[language];
  let m: RegExpMatchArray | null;

  if ((m = text.match(/^ROOM\s+(.+)$/))) return `${d.ROOM ?? 'ROOM'}  ${m[1]}`;
  if ((m = text.match(/^TITLE\s+(.+)$/))) return `${d.TITLE ?? 'TITLE'}  ${m[1]}`;
  if ((m = text.match(/^PLAYERS\s+(.+)$/))) return `${d.PLAYERS ?? 'PLAYERS'}  ${m[1]}`;
  if ((m = text.match(/^현재 역할\s+(.+)$/))) return `${d['현재 역할'] ?? '현재 역할'}  ${m[1]}`;
  if ((m = text.match(/^Hunter 지원\s+(.+)$/))) return `${d['Hunter 지원'] ?? 'Hunter 지원'}  ${d[m[1]] ?? m[1]}`;
  if ((m = text.match(/^시작 시 Hunter 수\s+(.+)$/))) return `${d['시작 시 Hunter 수'] ?? '시작 시 Hunter 수'}  ${m[1]}`;
  if ((m = text.match(/^MAP\s+(.+)$/))) return `${d.MAP ?? 'MAP'}  ${d[m[1]] ?? m[1]}`;
  if ((m = text.match(/^PLAYERS (.+)$/))) return `${d.PLAYERS ?? 'PLAYERS'} ${m[1]}`;
  if ((m = text.match(/^ROLE (.+)$/))) {
    const roleLabel = language === 'ja' ? '役割' : language === 'zh' ? '角色' : language === 'ko' ? '역할' : 'ROLE';
    return `${roleLabel} ${m[1]}`;
  }
  if ((m = text.match(/^HIDER (\d+) 선택$/))) return language==='ja'?`HIDER ${m[1]} 選択`:language==='zh'?`选择 HIDER ${m[1]}`:language==='en'?`Select HIDER ${m[1]}`:`HIDER ${m[1]} 선택`;
  if ((m = text.match(/^게임 시작까지 (\d+)초$/))) return language==='ja'?`ゲーム開始まで ${m[1]}秒`:language==='zh'?`距离游戏开始还有 ${m[1]}秒`:language==='en'?`Game starts in ${m[1]}s`:`게임 시작까지 ${m[1]}초`;
  if ((m = text.match(/^(\d+)초 안에 위장하세요$/))) return language==='ja'?`${m[1]}秒以内に擬態してください`:language==='zh'?`请在${m[1]}秒内完成伪装`:language==='en'?`Camouflage within ${m[1]}s`:`${m[1]}초 안에 위장하세요`;
  if ((m = text.match(/^(\d+)초 안에 하이더를 찾으세요$/))) return language==='ja'?`${m[1]}秒以内にHIDERを見つけてください`:language==='zh'?`请在${m[1]}秒内找到HIDER`:language==='en'?`Find the Hiders within ${m[1]}s`:`${m[1]}초 안에 하이더를 찾으세요`;
  if ((m = text.match(/^(.+) 님의 연결이 끊겼습니다\.$/))) return language==='ja'?`${m[1]} さんの接続が切れました。`:language==='zh'?`${m[1]} 已断开连接。`:language==='en'?`${m[1]} disconnected.`:`${m[1]} 님의 연결이 끊겼습니다.`;
  if ((m = text.match(/^현재 (.+) · (\d+)$/))) return language==='ja'?`現在 ${m[1]} · ${m[2]}`:language==='zh'?`当前 ${m[1]} · ${m[2]}`:language==='en'?`Current ${m[1]} · ${m[2]}`:`현재 ${m[1]} · ${m[2]}`;
  if ((m = text.match(/^색상 추출 (#[0-9A-Fa-f]+)$/))) return language==='ja'?`色を取得 ${m[1]}`:language==='zh'?`已提取颜色 ${m[1]}`:language==='en'?`Sampled ${m[1]}`:`색상 추출 ${m[1]}`;
  if ((m = text.match(/^(.+) 브러시$/))) return language==='ja'?`${m[1]} ブラシ`:language==='zh'?`${m[1]} 画笔`:language==='en'?`${m[1]} brush`:`${m[1]} 브러시`;
  if ((m = text.match(/^ZOOM (.+)$/))) return `ZOOM ${m[1]}`;
  if ((m = text.match(/^BRUSH (.+)$/))) return `${d.BRUSH ?? 'BRUSH'} ${m[1]}`;
  if ((m = text.match(/^COLOR (.+)$/))) return `${d.COLOR ?? 'COLOR'} ${m[1]}`;
  if ((m = text.match(/^PAINT (.+)$/))) return `${d.PAINT ?? 'PAINT'} ${m[1]}`;
  if ((m = text.match(/^TIME (.+)$/))) return `${d.TIME ?? 'TIME'} ${m[1]}`;
  if ((m = text.match(/^HIDERS (.+)$/))) return `${d.HIDERS ?? 'HIDERS'} ${m[1]}`;
  if ((m = text.match(/^SHELLS (.+)$/))) return `${d.SHELLS ?? 'SHELLS'} ${m[1]}`;
  if ((m = text.match(/^HIDE (.+)$/))) {
    const label = language==='ja'?'隠密':language==='zh'?'隐藏':language==='ko'?'은신':'HIDE';
    return `${label} ${m[1]}`;
  }
  return undefined;
}

export function trPhase(phase: string): string {
  const language = getLanguage();
  const labels: Record<GameLanguage, Record<string, string>> = {
    ko: { lobby: '대기', countdown: '시작 준비', paint: '색칠', hunt: '사냥', finished: '종료' },
    ja: { lobby: '待機', countdown: '開始準備', paint: 'ペイント', hunt: 'ハント', finished: '終了' },
    en: { lobby: 'LOBBY', countdown: 'STARTING', paint: 'PAINT', hunt: 'HUNT', finished: 'FINISHED' },
    zh: { lobby: '大厅', countdown: '准备开始', paint: '涂色', hunt: '狩猎', finished: '结束' },
  };
  return labels[language][phase] ?? phase.toUpperCase();
}

export function tr(text: string): string {
  const language = getLanguage();
  return dictionaries[language][text] ?? dynamicTranslate(text, language) ?? text;
}
