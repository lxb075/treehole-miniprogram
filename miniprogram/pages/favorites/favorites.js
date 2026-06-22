// pages/favorites/favorites.js - 收藏夹 / 我的树洞 / 我的点赞
const db = wx.cloud.database()
const app = getApp()
const { getAnimalAvatar } = require('../../utils/animal.js')

Page({
  data: {
    messageList: [],
    loading: true,
    type: 'favorited', // favorited | posted | liked
    pageTitle: '我的收藏夹',
    pageSubtitle: '那些让你心头一暖的句子'
  },

  onLoad(options) {
    const type = options.type || 'favorited'
    let pageTitle = '我的收藏夹'
    let pageSubtitle = '那些让你心头一暖的句子'
    if (type === 'posted') {
      pageTitle = '我的树洞'
      pageSubtitle = '曾经放进树洞的心事,长按可删除'
    } else if (type === 'liked') {
      pageTitle = '我点过的赞'
      pageSubtitle = '送出过的每一份温柔'
    }
    this.setData({ type, pageTitle, pageSubtitle })
    wx.setNavigationBarTitle({ title: pageTitle })
  },

  onShow() {
    this.loadList()
  },

  onPullDownRefresh() {
    this.loadList().finally(() => wx.stopPullDownRefresh())
  },

  loadList() {
    const userId = app.globalData.getUserId()
    const { type } = this.data
    this.setData({ loading: true })

    if (type === 'favorited') {
      return this.loadFavorites(userId)
    } else if (type === 'posted') {
      return this.loadPosted(userId)
    } else if (type === 'liked') {
      return this.loadLiked(userId)
    }
  },

  // 加载收藏
  loadFavorites(userId) {
    // 5 秒超时保护
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('加载超时')), 5000))
    Promise.race([
      db.collection('treehole_favorites')
        .where({ userId })
        .orderBy('createTime', 'desc')
        .get(),
      timeout
    ])
      .then(res => {
        const ids = (res.data || []).map(item => item.messageId)
        if (ids.length === 0) {
          this.setData({ messageList: [], loading: false })
          return Promise.resolve()
        }
        return db.collection('treehole_messages')
          .where({ _id: db.command.in(ids) })
          .get()
          .then(msgRes => {
            const messageMap = new Map((msgRes.data || []).map(m => [m._id, m]))
            const list = ids
              .map(id => messageMap.get(id))
              .filter(Boolean)
              .map(item => {
                const seed = item._openid || item.anonymousName || item._id
                return {
                  ...item,
                  hasLiked: false,
                  hasFavorited: true,
                  likeCount: item.likeCount || 0,
                  animal: getAnimalAvatar(seed),
                  createTimeText: this.formatTime(item.createTime)
                }
              })
            this.setData({ messageList: list, loading: false })
            this.checkLikedState(list)
          })
      })
      .catch(err => {
        console.error('加载收藏失败:', err)
        this.setData({ loading: false, messageList: [] })
        wx.showToast({ title: '加载失败,请重试', icon: 'none' })
      })
  },

  // 加载我发布的内容(支持删除)
  loadPosted(userId) {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('加载超时')), 5000))
    Promise.race([
      db.collection('treehole_messages')
        .where({ userId })
        .orderBy('createTime', 'desc')
        .get(),
      timeout
    ])
      .then(res => {
        const list = (res.data || []).map(item => {
          const seed = item._openid || item.anonymousName || item._id
          return {
            ...item,
            hasLiked: false,
            hasFavorited: false,
            likeCount: item.likeCount || 0,
            animal: getAnimalAvatar(seed),
            canDelete: true,
            // 预处理时间字符串,避免 WXML 无法直接调用 Page 方法
            createTimeText: this.formatTime(item.createTime)
          }
        })
        this.setData({ messageList: list, loading: false })
      })
      .catch(err => {
        console.error('加载我的留言失败:', err)
        this.setData({ loading: false, messageList: [] })
        wx.showToast({ title: '加载失败,请重试', icon: 'none' })
      })
  },

  // 加载我点过的赞
  loadLiked(userId) {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('加载超时')), 5000))
    Promise.race([
      db.collection('treehole_likes')
        .where({ userId })
        .orderBy('createTime', 'desc')
        .get(),
      timeout
    ])
      .then(res => {
        const ids = (res.data || []).map(item => item.messageId)
        if (ids.length === 0) {
          this.setData({ messageList: [], loading: false })
          return Promise.resolve()
        }
        return db.collection('treehole_messages')
          .where({ _id: db.command.in(ids) })
          .get()
          .then(msgRes => {
            const messageMap = new Map((msgRes.data || []).map(m => [m._id, m]))
            const list = ids
              .map(id => messageMap.get(id))
              .filter(Boolean)
              .map(item => {
                const seed = item._openid || item.anonymousName || item._id
                return {
                  ...item,
                  hasLiked: true,
                  hasFavorited: false,
                  likeCount: item.likeCount || 0,
                  animal: getAnimalAvatar(seed),
                  createTimeText: this.formatTime(item.createTime)
                }
              })
            this.setData({ messageList: list, loading: false })
            this.checkFavState(list)
          })
      })
      .catch(err => {
        console.error('加载点赞失败:', err)
        this.setData({ loading: false, messageList: [] })
        wx.showToast({ title: '加载失败,请重试', icon: 'none' })
      })
  },

  // 检查点赞状态
  checkLikedState(list) {
    const userId = app.globalData.getUserId()
    const ids = list.map(m => m._id)
    if (ids.length === 0) return
    db.collection('treehole_likes')
      .where({ userId, messageId: db.command.in(ids) })
      .get()
      .catch(() => ({ data: [] }))
      .then(res => {
        const likedIds = new Set((res.data || []).map(item => item.messageId))
        const updated = this.data.messageList.map(msg => ({
          ...msg,
          hasLiked: likedIds.has(msg._id)
        }))
        this.setData({ messageList: updated })
      })
  },

  // 检查收藏状态
  checkFavState(list) {
    const userId = app.globalData.getUserId()
    const ids = list.map(m => m._id)
    if (ids.length === 0) return
    db.collection('treehole_favorites')
      .where({ userId, messageId: db.command.in(ids) })
      .get()
      .catch(() => ({ data: [] }))
      .then(res => {
        const favIds = new Set((res.data || []).map(item => item.messageId))
        const updated = this.data.messageList.map(msg => ({
          ...msg,
          hasFavorited: favIds.has(msg._id)
        }))
        this.setData({ messageList: updated })
      })
  },

  // 跳转到详情
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  // 长按删除(仅 posted 类型)
  handleLongPress(e) {
    if (this.data.type !== 'posted') return
    const id = e.currentTarget.dataset.id
    const content = e.currentTarget.dataset.content || ''
    wx.showModal({
      title: '删除这条留言?',
      content: content.length > 30 ? content.substring(0, 30) + '...' : content,
      confirmText: '删除',
      cancelText: '保留',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          this.deleteMessage(id)
        }
      }
    })
  },

  // 删除留言
  deleteMessage(messageId) {
    if (!messageId) return
    wx.showLoading({ title: '删除中...', mask: true })

    // 5 秒超时
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('删除超时')), 5000))

    // 同时清理相关的点赞和收藏记录
    Promise.all([
      Promise.race([
        db.collection('treehole_messages').doc(messageId).remove(),
        timeout
      ]).catch(e => console.warn('删除留言失败:', e)),
      db.collection('treehole_likes').where({ messageId }).remove()
        .catch(e => console.warn('清理点赞失败:', e)),
      db.collection('treehole_favorites').where({ messageId }).remove()
        .catch(e => console.warn('清理收藏失败:', e))
    ]).then(() => {
      const newList = this.data.messageList.filter(m => m._id !== messageId)
      this.setData({ messageList: newList })
      wx.hideLoading()
      wx.showToast({ title: '已删除', icon: 'success', duration: 1500 })
    }).catch(err => {
      wx.hideLoading()
      console.error('删除失败:', err)
      wx.showToast({ title: '删除失败,请重试', icon: 'none' })
    })
  },

  // 切换收藏状态
  handleFavorite(e) {
    const id = e.currentTarget.dataset.id
    const hasFavorited = e.currentTarget.dataset.favorited === 'true'
    const userId = app.globalData.getUserId()
    if (hasFavorited) {
      this.removeFavorite(id, userId)
    } else {
      this.addFavorite(id, userId)
    }
  },

  addFavorite(messageId, userId) {
    db.collection('treehole_favorites')
      .where({ messageId, userId })
      .get()
      .then(res => {
        if (res.data.length > 0) return Promise.resolve()
        return db.collection('treehole_favorites').add({
          data: { messageId, userId, createTime: Date.now() }
        })
      })
      .then(() => {
        this.updateLocalFav(messageId, true)
        wx.showToast({ title: '已收藏到心里', icon: 'none', duration: 1200 })
      })
      .catch(err => {
        console.error('收藏失败:', err)
        wx.showToast({ title: '收藏失败,请重试', icon: 'none' })
      })
  },

  removeFavorite(messageId, userId) {
    db.collection('treehole_favorites')
      .where({ messageId, userId })
      .get()
      .then(res => {
        const removeOps = res.data.map(item =>
          db.collection('treehole_favorites').doc(item._id).remove()
        )
        return Promise.all(removeOps)
      })
      .then(() => {
        this.updateLocalFav(messageId, false)
        if (this.data.type === 'favorited') {
          this.setData({ messageList: this.data.messageList.filter(m => m._id !== messageId) })
        }
        wx.showToast({ title: '已从收藏移除', icon: 'none', duration: 1200 })
      })
      .catch(err => {
        console.error('取消收藏失败:', err)
        wx.showToast({ title: '操作失败,请重试', icon: 'none' })
      })
  },

  updateLocalFav(messageId, hasFavorited) {
    const updated = this.data.messageList.map(msg =>
      msg._id === messageId ? { ...msg, hasFavorited } : msg
    )
    this.setData({ messageList: updated })
  },

  // 预览图片
  previewImage(e) {
    const url = e.currentTarget.dataset.url
    if (!url) return
    wx.previewImage({ urls: [url] })
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
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  }
})
