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

  // 点赞
  handleLike() {
    const message = this.data.message
    if (!message) return
    if (message._likeLock) return
    this.setData({ 'message._likeLock': true })
    const userId = app.globalData.getUserId()
    if (message.hasLiked) {
      this.cancelLike(message._id, userId)
    } else {
      this.addLike(message._id, userId)
    }
  },

  // 点赞:始终 add 一条 + inc(+1),不做嵌套查重
  addLike(messageId, userId) {
    db.collection('treehole_likes').add({
      data: { messageId, userId, createTime: Date.now() }
    })
      .then(() => db.collection('treehole_messages').doc(messageId)
        .update({ data: { likeCount: db.command.inc(1) } }))
      .then(() => {
        this.setData({
          'message.hasLiked': true,
          'message.likeCount': (this.data.message.likeCount || 0) + 1
        })
        wx.showToast({ title: '送出一个小心心', icon: 'none' })
      })
      .catch(err => {
        console.error('点赞失败:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ 'message._likeLock': false })
      })
  },

  // 取消点赞:get → doc.remove → inc(-1)
  cancelLike(messageId, userId) {
    db.collection('treehole_likes')
      .where({ messageId, userId })
      .limit(1)
      .get()
      .then(res => {
        if (!res.data || res.data.length === 0) return null
        return db.collection('treehole_likes').doc(res.data[0]._id).remove()
      })
      .then(() => db.collection('treehole_messages').doc(messageId)
        .update({ data: { likeCount: db.command.inc(-1) } }))
      .then(() => {
        this.setData({
          'message.hasLiked': false,
          'message.likeCount': Math.max(0, (this.data.message.likeCount || 0) - 1)
        })
        wx.showToast({ title: '已收回小心心', icon: 'none' })
      })
      .catch(err => {
        console.error('取消点赞失败:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ 'message._likeLock': false })
      })
  },

  // 收藏
  handleFavorite() {
    const message = this.data.message
    if (!message) return
    if (message._favLock) return
    this.setData({ 'message._favLock': true })
    const userId = app.globalData.getUserId()
    if (message.hasFavorited) {
      this.removeFav(message._id, userId)
    } else {
      this.addFav(message._id, userId)
    }
  },

  addFav(messageId, userId) {
    db.collection('treehole_favorites').add({
      data: { messageId, userId, createTime: Date.now() }
    })
      .then(() => {
        this.setData({ 'message.hasFavorited': true })
        wx.showToast({ title: '已收藏到心里', icon: 'none' })
      })
      .catch(err => {
        console.error('收藏失败:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ 'message._favLock': false })
      })
  },

  removeFav(messageId, userId) {
    db.collection('treehole_favorites')
      .where({ messageId, userId })
      .limit(1)
      .get()
      .then(res => {
        if (!res.data || res.data.length === 0) return null
        return db.collection('treehole_favorites').doc(res.data[0]._id).remove()
      })
      .then(() => {
        this.setData({ 'message.hasFavorited': false })
        wx.showToast({ title: '已从收藏移除', icon: 'none' })
      })
      .catch(err => {
        console.error('取消收藏失败:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
      .finally(() => {
        this.setData({ 'message._favLock': false })
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
