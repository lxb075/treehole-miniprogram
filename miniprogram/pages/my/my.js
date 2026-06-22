// pages/my/my.js - 个人中心
const db = wx.cloud.database()
const app = getApp()
const { getAnimalAvatar } = require('../../utils/animal.js')

Page({
  data: {
    currentUser: null,
    stats: {
      posted: 0,
      liked: 0,
      favorited: 0
    }
  },

  onLoad() {
    this.refreshUser()
  },

  onShow() {
    this.refreshUser()
    this.loadStats()
  },

  // 刷新当前用户信息
  refreshUser() {
    const user = app.getDisplayUser()
    const animal = getAnimalAvatar(user.nickName || app.globalData.openid || 'treehole')
    this.setData({
      currentUser: { ...user, animal }
    })
  },

  // 触发授权
  handleAuthorize() {
    wx.showLoading({ title: '登录中...', mask: true })
    app.authorizeUserProfile().then(info => {
      wx.hideLoading()
      if (info) {
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1500 })
        this.refreshUser()
      } else {
        wx.showToast({ title: '已取消授权', icon: 'none' })
      }
    })
  },

  loadStats() {
    const userId = app.globalData.getUserId()
    Promise.all([
      db.collection('treehole_messages').where({ userId }).count().catch(() => ({ total: 0 })),
      db.collection('treehole_likes').where({ userId }).count().catch(() => ({ total: 0 })),
      db.collection('treehole_favorites').where({ userId }).count().catch(() => ({ total: 0 }))
    ]).then(([postedRes, likedRes, favRes]) => {
      this.setData({
        stats: {
          posted: postedRes.total || 0,
          liked: likedRes.total || 0,
          favorited: favRes.total || 0
        }
      })
    }).catch(err => {
      console.error('加载统计失败:', err)
    })
  },

  goToFavorites() {
    wx.navigateTo({ url: '/pages/favorites/favorites?type=favorited' })
  },

  goToMyPosts() {
    wx.navigateTo({ url: '/pages/favorites/favorites?type=posted' })
  },

  goToLiked() {
    wx.navigateTo({ url: '/pages/favorites/favorites?type=liked' })
  },

  goToPublish() {
    wx.switchTab({ url: '/pages/publish/publish' })
  },

  showAbout() {
    wx.showModal({
      title: '关于校园树洞',
      content: '这是一个让心事有处安放的小角落。\n\n匿名倾诉,温柔回应。\n愿你在这里,被世界温柔以待。\n\n🌿 你的每一句话,都是对自己温柔的回应。',
      showCancel: false,
      confirmText: '收到'
    })
  }
})
