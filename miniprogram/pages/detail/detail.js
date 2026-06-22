// pages/detail/detail.js - 树洞详情
const db = wx.cloud.database()
const app = getApp()
const { getAnimalAvatar } = require('../../utils/animal.js')

Page({
  data: {
    message: null,
    loading: true,
    messageId: ''
  },

  onLoad(options) {
    this.setData({ messageId: options.id || '' })
    this.loadDetail()
  },

  // 重试
  onRetry() {
    this.loadDetail()
  },

  // 返回广场
  goBack() {
    wx.navigateBack({ delta: 1, fail: () => {
      wx.switchTab({ url: '/pages/index/index' })
    }})
  },

  // 浮动按钮:返回"我的"
  goMy() {
    wx.switchTab({ url: '/pages/my/my' })
  },

  loadDetail() {
    const id = this.data.messageId
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
      return
    }
    this.setData({ loading: true })
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('加载超时')), 5000))
    Promise.race([
      db.collection('treehole_messages').doc(id).get(),
      timeout
    ]).then(res => {
      const item = res.data
      if (!item || !item._id) {
        this.setData({ loading: false, message: null })
        return
      }
      const seed = item._openid || item.anonymousName || item._id
      const animal = getAnimalAvatar(seed)
      const message = {
        ...item,
        likeCount: item.likeCount || 0,
        hasLiked: false,
        hasFavorited: false,
        animal,
        // 预处理时间字符串,避免 WXML 无法直接调用 Page 方法
        createTimeText: this.formatTime(item.createTime)
      }
      this.setData({ loading: false, message })
      this.checkUserState(id)
    }).catch(err => {
      console.error('加载详情失败:', err)
      this.setData({ loading: false, message: null })
      wx.showToast({ title: '加载失败', icon: 'none' })
    })
  },

  checkUserState(messageId) {
    const userId = app.globalData.getUserId()
    Promise.all([
      db.collection('treehole_likes').where({ userId, messageId }).count().catch(() => ({ total: 0 })),
      db.collection('treehole_favorites').where({ userId, messageId }).count().catch(() => ({ total: 0 }))
    ]).then(([likesRes, favRes]) => {
      this.setData({
        'message.hasLiked': (likesRes.total || 0) > 0,
        'message.hasFavorited': (favRes.total || 0) > 0
      })
    })
  },

  // 点赞:乐观更新架构
  handleLike() {
    const message = this.data.message
    if (!message) return
    if (message._likeLock) return
    this.setData({ 'message._likeLock': true })

    const hasLiked = !!message.hasLiked
    // 1. 立即更新 UI
    this.setData({
      'message.hasLiked': !hasLiked,
      'message.likeCount': hasLiked
        ? Math.max(0, (this.data.message.likeCount || 0) - 1)
        : (this.data.message.likeCount || 0) + 1
    })
    wx.showToast({
      title: hasLiked ? '已收回小心心' : '送出一个小心心',
      icon: 'none'
    })

    // 2. 异步云调用
    const userId = app.globalData.getUserId()
    const op = hasLiked
      ? this.cancelLikeRemote(message._id, userId)
      : this.addLikeRemote(message._id, userId)
    op.catch(err => console.warn('点赞云端同步失败(不影响UI):', err))

    setTimeout(() => this.setData({ 'message._likeLock': false }), 300)
  },

  addLikeRemote(messageId, userId) {
    return db.collection('treehole_likes').add({
      data: { messageId, userId, createTime: Date.now() }
    })
      .then(() => db.collection('treehole_messages').doc(messageId)
        .update({ data: { likeCount: db.command.inc(1) } }))
  },

  cancelLikeRemote(messageId, userId) {
    return db.collection('treehole_likes')
      .where({ messageId, userId })
      .limit(1)
      .get()
      .then(res => {
        if (!res.data || res.data.length === 0) return null
        return db.collection('treehole_likes').doc(res.data[0]._id).remove()
      })
      .then(() => db.collection('treehole_messages').doc(messageId)
        .update({ data: { likeCount: db.command.inc(-1) } }))
  },

  // 收藏:乐观更新架构
  handleFavorite() {
    const message = this.data.message
    if (!message) return
    if (message._favLock) return
    this.setData({ 'message._favLock': true })

    const hasFavorited = !!message.hasFavorited
    // 1. 立即更新 UI
    this.setData({ 'message.hasFavorited': !hasFavorited })
    wx.showToast({
      title: hasFavorited ? '已从收藏移除' : '已收藏到心里',
      icon: 'none'
    })

    // 2. 异步云调用
    const userId = app.globalData.getUserId()
    const op = hasFavorited
      ? this.removeFavRemote(message._id, userId)
      : this.addFavRemote(message._id, userId)
    op.catch(err => console.warn('收藏云端同步失败(不影响UI):', err))

    setTimeout(() => this.setData({ 'message._favLock': false }), 300)
  },

  addFavRemote(messageId, userId) {
    return db.collection('treehole_favorites').add({
      data: { messageId, userId, createTime: Date.now() }
    })
  },

  removeFavRemote(messageId, userId) {
    return db.collection('treehole_favorites')
      .where({ messageId, userId })
      .limit(1)
      .get()
      .then(res => {
        if (!res.data || res.data.length === 0) return null
        return db.collection('treehole_favorites').doc(res.data[0]._id).remove()
      })
  },

  // 预览图片
  previewImage() {
    if (!this.data.message || !this.data.message.imageFileID) return
    wx.previewImage({ urls: [this.data.message.imageFileID] })
  },

  formatTime(timestamp) {
    if (!timestamp) return '时间未知'
    const date = new Date(timestamp)
    const t = date.getTime()
    if (isNaN(t)) return '时间未知'
    const now = new Date()
    const diff = now.getTime() - t
    if (diff < 0) return '刚刚'
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
    const y = date.getFullYear()
    const m = date.getMonth() + 1
    const d = date.getDate()
    const h = String(date.getHours()).padStart(2, '0')
    const min = String(date.getMinutes()).padStart(2, '0')
    return `${y}-${m}-${d} ${h}:${min}`
  }
})
