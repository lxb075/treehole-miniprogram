// q版动物头像工具 - 优先按昵称/种子中的关键词匹配,否则 hash 兜底
const ANIMAL_LIST = [
  { emoji: '🐱', name: '小猫',   keys: ['小猫', 'cat', 'kitty', '喵'],         bg: ['#FFD1DC', '#FFB6C1'] },
  { emoji: '🐶', name: '小狗',   keys: ['小狗', 'dog', '汪', '柴犬', '柯基'],  bg: ['#FFE4B5', '#FFDAB9'] },
  { emoji: '🐼', name: '熊猫',   keys: ['熊猫', 'panda', '团团', '圆滚滚'],     bg: ['#E8E8E8', '#B8B8B8'] },
  { emoji: '🐰', name: '小兔',   keys: ['兔', 'rabbit', 'bunny'],              bg: ['#FFE4E1', '#FFC0CB'] },
  { emoji: '🦊', name: '小狐',   keys: ['狐', 'fox'],                          bg: ['#FFB088', '#FF8C61'] },
  { emoji: '🐨', name: '考拉',   keys: ['考拉', 'koala'],                      bg: ['#D3D3D3', '#A0A0A0'] },
  { emoji: '🐯', name: '小虎',   keys: ['虎', 'tiger', '老虎'],                bg: ['#FFE066', '#FFB347'] },
  { emoji: '🦁', name: '小狮',   keys: ['狮', 'lion', '狮子'],                  bg: ['#FFD97D', '#DAA520'] },
  { emoji: '🐮', name: '小牛',   keys: ['牛', 'cow', '牛牛'],                   bg: ['#F5DEB3', '#DEB887'] },
  { emoji: '🐷', name: '小猪',   keys: ['猪', 'pig', '佩奇'],                   bg: ['#FFC8DD', '#FFB3C6'] },
  { emoji: '🐸', name: '小蛙',   keys: ['蛙', 'frog', '青蛙'],                  bg: ['#B7E4C7', '#74C69D'] },
  { emoji: '🐵', name: '小猴',   keys: ['猴', 'monkey'],                       bg: ['#E6C79C', '#C8A165'] },
  { emoji: '🐧', name: '企鹅',   keys: ['企鹅', 'penguin', 'qie'],              bg: ['#CFE2F3', '#6FA8DC'] },
  { emoji: '🦄', name: '独角兽', keys: ['独角兽', 'unicorn'],                   bg: ['#EAD7FF', '#C8A2E0'] },
  { emoji: '🐝', name: '小蜂',   keys: ['蜂', 'bee', '蜜蜂'],                   bg: ['#FFF1A8', '#FFD93D'] },
  { emoji: '🦋', name: '蝴蝶',   keys: ['蝶', 'butterfly', '蝴蝶'],             bg: ['#CDE7FF', '#8FB8E8'] },
  { emoji: '🐢', name: '小龟',   keys: ['龟', 'turtle', '乌龟'],                bg: ['#BFE3C2', '#7FB77E'] },
  { emoji: '🐳', name: '鲸鱼',   keys: ['鲸', 'whale', '鲸鱼'],                 bg: ['#BFE0FF', '#6FB1E0'] },
  { emoji: '🦀', name: '小蟹',   keys: ['蟹', 'crab', '螃蟹'],                  bg: ['#FFC4B8', '#FF8A75'] },
  { emoji: '🦉', name: '猫头鹰', keys: ['猫头鹰', 'owl', '咕咕'],               bg: ['#E0C8A0', '#B8956A'] },
  { emoji: '🐹', name: '仓鼠',   keys: ['仓鼠', 'hamster'],                     bg: ['#FFE2C2', '#FFB877'] },
  { emoji: '🐻', name: '小熊',   keys: ['熊', 'bear', '小熊'],                   bg: ['#E8C39E', '#B58968'] },
  { emoji: '🐦', name: '小鸟',   keys: ['鸟', 'bird', '啾啾'],                   bg: ['#C7E9F1', '#7CC4D9'] },
  { emoji: '🐿️', name: '松鼠',   keys: ['松鼠', 'squirrel'],                    bg: ['#E8C39E', '#C68B59'] },
  { emoji: '🦔', name: '小刺猬', keys: ['刺猬', 'hedgehog'],                    bg: ['#E8D3C0', '#B8956A'] },
  { emoji: '🐺', name: '小狼',   keys: ['狼', 'wolf'],                          bg: ['#C8C0B8', '#8B7E74'] },
  { emoji: '🦘', name: '袋鼠',   keys: ['袋鼠', 'kangaroo'],                    bg: ['#F0C8A0', '#D49B6E'] },
  { emoji: '🐬', name: '海豚',   keys: ['海豚', 'dolphin'],                     bg: ['#BFE0FF', '#5A9BD4'] }
]

// 简单稳定的字符串 hash
function hashCode(str) {
  let hash = 0
  if (!str) return 0
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + chr
    hash |= 0
  }
  return Math.abs(hash)
}

// 根据昵称/种子中的关键词匹配动物
function matchByKeyword(seed) {
  if (!seed) return null
  const lower = String(seed).toLowerCase()
  // 用「最长关键词优先」避免「小猫」被「猫」抢匹配
  const all = []
  ANIMAL_LIST.forEach(a => (a.keys || []).forEach(k => all.push({ animal: a, key: k })))
  all.sort((a, b) => b.key.length - a.key.length)
  for (let i = 0; i < all.length; i++) {
    if (lower.indexOf(all[i].key.toLowerCase()) !== -1) {
      return all[i].animal
    }
  }
  return null
}

// 根据种子获取稳定的小动物头像
// 优先按昵称中的关键词匹配,匹配不到再 hash 随机
function getAnimalAvatar(seed) {
  if (!seed) seed = 'anonymous'
  const matched = matchByKeyword(seed)
  const animal = matched || ANIMAL_LIST[hashCode(seed) % ANIMAL_LIST.length]
  return {
    emoji: animal.emoji,
    name: animal.name,
    gradient: `linear-gradient(135deg, ${animal.bg[0]} 0%, ${animal.bg[1]} 100%)`
  }
}

module.exports = {
  ANIMAL_LIST,
  getAnimalAvatar,
  matchByKeyword,
  hashCode
}
