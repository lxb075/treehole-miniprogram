// pages/index/index.js - 树洞广场
const db = wx.cloud.database()
const app = getApp()
const { getAnimalAvatar } = require('../../utils/animal.js')

Page({
  data: {
    messageList: [],
    hasMore: true,
    pageSize: 10,
    lastTime: null,
    isLoading: false,
    // 防止快速重复点击的锁
    likeLock: {},
    favLock: {},
    // 用户在本次会话中操作过的 messageId,checkUserStates 会跳过这些
    // 防止异步回调把用户刚刚的"取消"再覆盖回去
    userTouched: {},
    // 当前用户信息(q版动物头)
    currentUser: null
  },

  onLoad() {
    this.refreshCurrentUser()
    this.loadMessages(true)
  },

  onShow() {
    this.refreshCurrentUser()
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadMessages(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 刷新当前用户(匿名/真实)
  refreshCurrentUser() {
    const user = app.getDisplayUser()
    this.setData({ currentUser: user })
  },

  /**
   * 加载留言列表
   * @param {boolean} reset - 是否重置列表(用于下拉刷新)
   */
  loadMessages(reset = false) {
    if (this.data.isLoading) return Promise.resolve()
    if (reset) {
      this.setData({ messageList: [], lastTime: null, hasMore: true })
    }
    this.setData({ isLoading: true })
    wx.showLoading({ title: '加载中...', mask: false })

    const pageSize = this.data.pageSize
    const lastTime = reset ? null : this.data.lastTime
    let query = db.collection('treehole_messages')
      .orderBy('createTime', 'desc')
      .limit(pageSize)

    if (lastTime) {
      query = query.lt('createTime', lastTime)
    }

    // 5 秒超时保护
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('云调用超时')), 5000)
    })

    return Promise.race([query.get(), timeoutPromise])
      .then(res => {
        const messages = (res.data || []).map(item => {
          // 为每条留言绑定 q版动物头像
          const seed = item._openid || item.anonymousName || item._id
          const animal = getAnimalAvatar(seed)
          return {
            ...item,
            hasLiked: false,
            hasFavorited: false,
            likeCount: item.likeCount || 0,
            animal,
            // 预处理时间字符串,避免 WXML 无法直接调用 Page 方法
            createTimeText: this.formatTime(item.createTime)
          }
        })

        // 判断是否还有更多
        const newHasMore = messages.length >= pageSize
        // 检查用户的点赞/收藏状态
        this.checkUserStates(messages)

        const finalList = lastTime
          ? [...this.data.messageList, ...messages]
          : messages
        const newLastTime = messages.length > 0
          ? messages[messages.length - 1].createTime
          : lastTime

        this.setData({
          messageList: finalList,
          lastTime: newLastTime,
          hasMore: newHasMore
        })
      })
      .catch(err => {
        console.error('加载留言失败:', err)
        if (reset) {
          this.setData({ messageList: [], hasMore: false })
        }
        wx.showToast({ title: '加载失败,请重试', icon: 'none', duration: 2000 })
      })
      .finally(() => {
        this.setData({ isLoading: false })
        wx.hideLoading()
      })
  },

  // 上拉加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.isLoading) return
    this.loadMessages(false)
  },

  // 合并查询用户的点赞与收藏状态
  checkUserStates(messages) {
    const userId = app.globalData.getUserId()
    const messageIds = messages.map(m => m._id)
    if (messageIds.length === 0) return

    Promise.all([
      db.collection('treehole_likes')
        .where({ userId, messageId: db.command.in(messageIds) })
        .get()
        .catch(() => ({ data: [] })),
      db.collection('treehole_favorites')
        .where({ userId, messageId: db.command.in(messageIds) })
        .get()
        .catch(() => ({ data: [] }))
    ]).then(([likesRes, favRes]) => {
      const likedIds = new Set((likesRes.data || []).map(item => item.messageId))
      const favIds = new Set((favRes.data || []).map(item => item.messageId))
      const touched = this.data.userTouched || {}
      const updatedList = this.data.messageList.map(msg => {
        // 用户在本次会话中已经手动操作过这条,不要用数据库结果覆盖
        if (touched[msg._id]) return msg
        return {
          ...msg,
          hasLiked: likedIds.has(msg._id),
          hasFavorited: favIds.has(msg._id)
        }
      })
      this.setData({ messageList: updatedList })
    }).catch(err => {
      console.warn('查询状态失败:', err)
    })
  },

  // ==================== 点赞 ====================
  // 架构:乐观更新 + fire-and-forget
  // - UI 立即变(心变红、数字 +1/-1)
  // - 云调用异步发送,失败不阻塞、不回滚
  // - 这样即使云开发 SDK 内部 timeout,交互依然流畅
  handleLike(e) {
    const id = e.currentTarget.dataset.id
    const hasLiked = e.currentTarget.dataset.liked === 'true'
    const userId = app.globalData.getUserId()

    if (this.data.likeLock[id]) return
    this.setData({ [`likeLock.${id}`]: true })

    // 1. 立即更新 UI(乐观)
    if (hasLiked) {
      this.updateLocalLike(id, false, true)
    } else {
      this.updateLocalLike(id, true, true)
    }
    this.setData({ [`userTouched.${id}`]: true })
    wx.showToast({
      title: hasLiked ? '已收回小心心' : '送出一个小心心',
      icon: 'none',
      duration: 1000
    })

    // 2. 异步发云调用(fire-and-forget,失败不阻塞 UI)
    const op = hasLiked
      ? this.cancelLikeRemote(id, userId)
      : this.addLikeRemote(id, userId)
    op.catch(err => console.warn('点赞云端同步失败(不影响UI):', err))

    // 3. 300ms 后释放锁(防快速连点,云端慢慢同步)
    setTimeout(() => {
      this.setData({ [`likeLock.${id}`]: false })
    }, 300)
  },

  // 远程:点赞(不 await)
  addLikeRemote(messageId, userId) {
    return db.collection('treehole_likes').add({
      data: { messageId, userId, createTime: Date.now() }
    })
      .then(() => db.collection('treehole_messages').doc(messageId)
        .update({ data: { likeCount: db.command.inc(1) } }))
  },

  // 远程:取消点赞(不 await)
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

  // 统一的本地状态更新入口
  // increment=false 时,只切换 hasLiked,不修改 likeCount(用于"记录已存在"等幂等场景)
  updateLocalLike(messageId, hasLiked, increment = true) {
    const updatedList = this.data.messageList.map(msg => {
      if (msg._id === messageId) {
        let likeCount = msg.likeCount || 0
        if (increment) {
          likeCount = hasLiked ? likeCount + 1 : Math.max(0, likeCount - 1)
        }
        return { ...msg, hasLiked, likeCount }
      }
      return msg
    })
    this.setData({ messageList: updatedList })
  },

  // ==================== 收藏 ====================
  // 同样采用乐观更新架构
  handleFavorite(e) {
    const id = e.currentTarget.dataset.id
    const hasFavorited = e.currentTarget.dataset.favorited === 'true'
    const userId = app.globalData.getUserId()

    if (this.data.favLock[id]) return
    this.setData({ [`favLock.${id}`]: true })

    // 1. 立即更新 UI
    this.updateLocalFav(id, !hasFavorited)
    this.setData({ [`userTouched.${id}`]: true })
    wx.showToast({
      title: hasFavorited ? '已从收藏移除' : '已收藏到心里',
      icon: 'none',
      duration: 1000
    })

    // 2. 异步发云调用
    const op = hasFavorited
      ? this.removeFavRemote(id, userId)
      : this.addFavRemote(id, userId)
    op.catch(err => console.warn('收藏云端同步失败(不影响UI):', err))

    // 3. 释放锁
    setTimeout(() => {
      this.setData({ [`favLock.${id}`]: false })
    }, 300)
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

  updateLocalFav(messageId, hasFavorited) {
    const updatedList = this.data.messageList.map(msg => {
      if (msg._id === messageId) {
        return { ...msg, hasFavorited }
      }
      return msg
    })
    this.setData({ messageList: updatedList })
  },

  // 跳转到详情页
  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
  },

  // 跳转到发布页
  goPublish() {
    wx.switchTab({ url: '/pages/publish/publish' })
  },

  // 跳转到个人中心
  goMy() {
    wx.switchTab({ url: '/pages/my/my' })
  },

  // 格式化为本地时间字符串(不依赖 new Date,直接格式化 timestamp)
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
