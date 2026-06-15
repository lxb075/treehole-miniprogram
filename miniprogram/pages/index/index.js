const db = wx.cloud.database()
const app = getApp()

Page({
  data: {
    messageList: [],
    hasMore: true,
    pageSize: 10,
    lastTime: null
  },

  onLoad() {
    this.loadMessages()
  },

  onShow() {
    this.loadMessages()
  },

  loadMessages() {
    const { pageSize, lastTime } = this.data
    const now = Date.now()
    const userId = app.globalData.getUserId()

    // 查询：未过期的留言 + 当前用户收藏的留言（永久保存）
    let query = db.collection('treehole_messages')
      .where(db.command.or([
        { expireTime: db.command.gt(now) },
        { favoritedBy: db.command.in([userId]) }
      ]))
      .orderBy('createTime', 'desc')
      .limit(pageSize)

    if (lastTime) {
      query = query.lt('createTime', lastTime)
    }

    query.get().then(res => {
      const messages = res.data.map(item => ({
        ...item,
        hasLiked: false,
        hasFavorited: (item.favoritedBy || []).includes(userId),
        likeCount: item.likeCount || 0,
        isExpired: item.expireTime && item.expireTime <= now && !(item.favoritedBy || []).includes(userId),
        remainingText: this.getRemainingText(item.expireTime, item.favoritedBy, userId)
      }))

      this.checkUserLikes(messages)

      if (messages.length < pageSize) {
        this.setData({ hasMore: false })
      }

      if (messages.length > 0) {
        this.setData({
          messageList: lastTime ? [...this.data.messageList, ...messages] : messages,
          lastTime: messages[messages.length - 1].createTime
        })
      }
    }).catch(err => {
      console.error('加载留言失败:', err)
    })
  },

  checkUserLikes(messages) {
    const userId = app.globalData.getUserId()
    const messageIds = messages.map(m => m._id)

    if (messageIds.length === 0) return

    db.collection('treehole_likes')
      .where({
        userId,
        messageId: db.command.in(messageIds)
      }).get().then(res => {
        const likedIds = new Set(res.data.map(item => item.messageId))
        const updatedList = this.data.messageList.map(msg => ({
          ...msg,
          hasLiked: likedIds.has(msg._id)
        }))
        this.setData({ messageList: updatedList })
      })
  },

  handleLike(e) {
    const id = e.currentTarget.dataset.id
    const hasLiked = e.currentTarget.dataset.liked === 'true'
    const userId = app.globalData.getUserId()

    if (hasLiked) {
      this.cancelLike(id, userId)
    } else {
      this.addLike(id, userId)
    }
  },

  addLike(messageId, userId) {
    const newLike = {
      messageId,
      userId,
      createTime: Date.now()
    }

    db.collection('treehole_likes').add({
      data: newLike
    }).then(() => {
      return db.collection('treehole_messages')
        .doc(messageId)
        .update({
          data: {
            likeCount: db.command.inc(1)
          }
        })
    }).then(() => {
      this.updateLocalLike(messageId, true)
      wx.showToast({ title: '点赞成功', icon: 'success' })
    }).catch(err => {
      console.error('点赞失败:', err)
      wx.showToast({ title: '点赞失败', icon: 'none' })
    })
  },

  cancelLike(messageId, userId) {
    db.collection('treehole_likes')
      .where({ messageId, userId })
      .get().then(res => {
        if (res.data.length > 0) {
          return db.collection('treehole_likes').doc(res.data[0]._id).remove()
        }
      }).then(() => {
        return db.collection('treehole_messages')
          .doc(messageId)
          .update({
            data: {
              likeCount: db.command.inc(-1)
            }
          })
      }).then(() => {
        this.updateLocalLike(messageId, false)
        wx.showToast({ title: '已取消点赞', icon: 'success' })
      }).catch(err => {
        console.error('取消点赞失败:', err)
        wx.showToast({ title: '取消失败', icon: 'none' })
      })
  },

  updateLocalLike(messageId, hasLiked) {
    const updatedList = this.data.messageList.map(msg => {
      if (msg._id === messageId) {
        return {
          ...msg,
          hasLiked,
          likeCount: hasLiked ? msg.likeCount + 1 : msg.likeCount - 1
        }
      }
      return msg
    })
    this.setData({ messageList: updatedList })
  },

  handleFavorite(e) {
    const id = e.currentTarget.dataset.id
    const hasFavorited = e.currentTarget.dataset.favorited === 'true'
    const userId = app.globalData.getUserId()

    if (hasFavorited) {
      this.cancelFavorite(id, userId)
    } else {
      this.addFavorite(id, userId)
    }
  },

  addFavorite(messageId, userId) {
    // 收藏时延长过期时间到 2099 年，实现永久保存
    const permanentExpire = new Date('2099-12-31').getTime()

    db.collection('treehole_messages')
      .doc(messageId)
      .update({
        data: {
          favoritedBy: db.command.push(userId),
          expireTime: permanentExpire
        }
      }).then(() => {
        this.updateLocalFavorite(messageId, true)
        wx.showToast({ title: '收藏成功，永久保存', icon: 'success' })
      }).catch(err => {
        console.error('收藏失败:', err)
        wx.showToast({ title: '收藏失败', icon: 'none' })
      })
  },

  cancelFavorite(messageId, userId) {
    db.collection('treehole_messages')
      .doc(messageId)
      .update({
        data: {
          favoritedBy: db.command.pull(userId)
        }
      }).then(() => {
        this.updateLocalFavorite(messageId, false)
        wx.showToast({ title: '已取消收藏', icon: 'success' })
      }).catch(err => {
        console.error('取消收藏失败:', err)
        wx.showToast({ title: '取消失败', icon: 'none' })
      })
  },

  updateLocalFavorite(messageId, hasFavorited) {
    const updatedList = this.data.messageList.map(msg => {
      if (msg._id === messageId) {
        return {
          ...msg,
          hasFavorited,
          isExpired: false
        }
      }
      return msg
    })
    this.setData({ messageList: updatedList })
  },

  handleShare(e) {
    const item = this.data.messageList[e.currentTarget.dataset.index]
    if (!item) return

    wx.showShareMenu({
      withShareTicket: true
    })

    wx.shareAppMessage({
      title: item.anonymousName + ' 说：' + item.content.substring(0, 20),
      path: '/pages/index/index'
    })
  },

  loadMore() {
    if (!this.data.hasMore) return
    this.loadMessages()
  },

  getRemainingText(expireTime, favoritedBy, userId) {
    if (!expireTime) return ''
    // 被当前用户收藏的留言永久保存
    if (favoritedBy && favoritedBy.includes(userId)) return '永久保存'
    const diff = expireTime - Date.now()
    if (diff <= 0) return '已过期'
    if (diff < 3600000) return `剩余${Math.ceil(diff / 60000)}分钟`
    if (diff < 86400000) return `剩余${Math.ceil(diff / 3600000)}小时`
    return `剩余${Math.ceil(diff / 86400000)}天`
  },

  formatTime(timestamp) {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`

    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  },

  onShareAppMessage() {
    return {
      title: '校园树洞 - 分享你的心声，倾听他人故事',
      path: '/pages/index/index'
    }
  }
})
