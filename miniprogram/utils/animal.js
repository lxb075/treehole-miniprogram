// q版动物头像工具 - 基于字符串种子稳定映射到可爱动物
const ANIMAL_LIST = [
  { emoji: '🐱', name: '小猫',   bg: ['#FFD1DC', '#FFB6C1'] },
  { emoji: '🐶', name: '小狗',   bg: ['#FFE4B5', '#FFDAB9'] },
  { emoji: '🐼', name: '熊猫',   bg: ['#E8E8E8', '#B8B8B8'] },
  { emoji: '🐰', name: '兔子',   bg: ['#FFE4E1', '#FFC0CB'] },
  { emoji: '🦊', name: '小狐',   bg: ['#FFB088', '#FF8C61'] },
  { emoji: '🐨', name: '考拉',   bg: ['#D3D3D3', '#A0A0A0'] },
  { emoji: '🐯', name: '小虎',   bg: ['#FFE066', '#FFB347'] },
  { emoji: '🦁', name: '小狮',   bg: ['#FFD97D', '#DAA520'] },
  { emoji: '🐮', name: '小牛',   bg: ['#F5DEB3', '#DEB887'] },
  { emoji: '🐷', name: '小猪',   bg: ['#FFC8DD', '#FFB3C6'] },
  { emoji: '🐸', name: '小蛙',   bg: ['#B7E4C7', '#74C69D'] },
  { emoji: '🐵', name: '小猴',   bg: ['#E6C79C', '#C8A165'] },
  { emoji: '🐧', name: '企鹅',   bg: ['#CFE2F3', '#6FA8DC'] },
  { emoji: '🦄', name: '独角兽', bg: ['#EAD7FF', '#C8A2E0'] },
  { emoji: '🐝', name: '小蜂',   bg: ['#FFF1A8', '#FFD93D'] },
  { emoji: '🦋', name: '蝴蝶',   bg: ['#CDE7FF', '#8FB8E8'] },
  { emoji: '🐢', name: '小龟',   bg: ['#BFE3C2', '#7FB77E'] },
  { emoji: '🐳', name: '鲸鱼',   bg: ['#BFE0FF', '#6FB1E0'] },
  { emoji: '🦀', name: '小蟹',   bg: ['#FFC4B8', '#FF8A75'] },
  { emoji: '🦉', name: '猫头鹰', bg: ['#E0C8A0', '#B8956A'] },
  { emoji: '🐹', name: '仓鼠',   bg: ['#FFE2C2', '#FFB877'] },
  { emoji: '🐻', name: '小熊',   bg: ['#E8C39E', '#B58968'] },
  { emoji: '🐰', name: '小兔',   bg: ['#FFD6E0', '#FFA8C5'] },
  { emoji: '🐦', name: '小鸟',   bg: ['#C7E9F1', '#7CC4D9'] },
  { emoji: '🐿️', name: '松鼠',   bg: ['#E8C39E', '#C68B59'] },
  { emoji: '🦔', name: '小刺猬', bg: ['#E8D3C0', '#B8956A'] },
  { emoji: '🐺', name: '小狼',   bg: ['#C8C0B8', '#8B7E74'] },
  { emoji: '🐗', name: '小野猪', bg: ['#E0C8B8', '#A8896E'] },
  { emoji: '🦘', name: '袋鼠',   bg: ['#F0C8A0', '#D49B6E'] },
  { emoji: '🐬', name: '海豚',   bg: ['#BFE0FF', '#5A9BD4'] }
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

// 根据种子获取稳定的小动物头像
function getAnimalAvatar(seed) {
  if (!seed) seed = 'anonymous'
  const idx = hashCode(seed) % ANIMAL_LIST.length
  const animal = ANIMAL_LIST[idx]
  return {
    emoji: animal.emoji,
    name: animal.name,
    gradient: `linear-gradient(135deg, ${animal.bg[0]} 0%, ${animal.bg[1]} 100%)`
  }
}

module.exports = {
  ANIMAL_LIST,
  getAnimalAvatar,
  hashCode
}
