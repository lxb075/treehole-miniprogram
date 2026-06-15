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
    var self = this
    const { pageSize, lastTime } = this.data
    const now = Date.now()
    const userId = app.globalData.getUserId()

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
      const messages = res.data.map(function(item) {
        var remainingText = self.getRemainingText(item.expireTime, item.favoritedBy || [], userId)
        return {
          _id: item._id,
          msgId: String(item._id),
          content: item.content,
          anonymousName: item.anonymousName,
          likeCount: item.likeCount || 0,
          createTime: item.createTime,
          expireTime: item.expireTime,
          favoritedBy: item.favoritedBy || [],
          hasLiked: false,
          hasFavorited: item.favoritedBy && item.favoritedBy.indexOf(userId) > -1,
          isExpired: item.expireTime && item.expireTime <= now && (!item.favoritedBy || item.favoritedBy.indexOf(userId) === -1),
          remainingText: remainingText
        }
      })

      if (messages.length < pageSize) {
        this.setData({ hasMore: false })
      }
      if (messages.length > 0) {
        this.setData({
          messageList: lastTime ? this.data.messageList.concat(messages) : messages,
          lastTime: messages[messages.length - 1].createTime
        })
      }

      // 异步加载点赞状态
      this.loadLikeStates(messages)
    }).catch(function(err) {
      console.error('加载留言失败:', err)
    })
  },

  loadLikeStates: function(messages) {
    var self = this
    var userId = app.globalData.getUserId()

    if (messages.length === 0) return

    var likePromises = messages.map(function(m) {
      return db.collection('treehole_likes')
        .where({
          userId: userId,
          messageId: m.msgId
        })
        .count()
        .then(function(res) {
          return { msgId: m.msgId, liked: res.total > 0 }
        })
        .catch(function() {
          return { msgId: m.msgId, liked: false }
        })
    })

    Promise.all(likePromises).then(function(results) {
      var likedMap = {}
      results.forEach(function(r) { likedMap[r.msgId] = r.liked })

      var list = self.data.messageList.map(function(msg) {
        if (likedMap[msg.msgId] !== undefined) {
          msg.hasLiked = likedMap[msg.msgId]
        }
        return msg
      })
      self.setData({ messageList: list })
    })
  },

  handleLike: function(e) {
    var msgId = e.currentTarget.dataset.id
    var userId = app.globalData.getUserId()
    var self = this

    wx.showLoading({ title: '处理中...' })

    // 实时查数据库判断是否已点赞
    db.collection('treehole_likes')
      .where({
        userId: userId,
        messageId: msgId
      })
      .get()
      .then(function(res) {
        if (res.data.length > 0) {
          // 已点赞 -> 取消
          return db.collection('treehole_likes').doc(res.data[0]._id).remove()
            .then(function() {
              return db.collection('treehole_messages').doc(res.data[0].messageId).update({
                data: { likeCount: db.command.inc(-1) }
              })
            })
            .then(function() {
              self.toggleLikeState(msgId, false, -1)
              wx.hideLoading()
              wx.showToast({ title: '已取消点赞', icon: 'success' })
            })
        } else {
          // 未点赞 -> 添加
          return db.collection('treehole_likes').add({
            data: {
              messageId: msgId,
              userId: userId,
              createTime: Date.now()
            }
          })
          .then(function() {
            return db.collection('treehole_messages').doc(msgId).update({
              data: { likeCount: db.command.inc(1) }
            })
          })
          .then(function() {
            self.toggleLikeState(msgId, true, 1)
            wx.hideLoading()
            wx.showToast({ title: '点赞成功', icon: 'success' })
          })
        }
      })
      .catch(function(err) {
        wx.hideLoading()
        console.error('点赞操作失败:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
  },

  toggleLikeState: function(msgId, hasLiked, delta) {
    var list = this.data.messageList.map(function(msg) {
      if (msg.msgId === msgId) {
        msg.hasLiked = hasLiked
        msg.likeCount = msg.likeCount + delta
      }
      return msg
    })
    this.setData({ messageList: list })
  },

  handleFavorite: function(e) {
    var msgId = e.currentTarget.dataset.id
    var userId = app.globalData.getUserId()
    var self = this

    wx.showLoading({ title: '处理中...' })

    // 实时查数据库判断是否已收藏
    db.collection('treehole_messages').doc(msgId).get()
      .then(function(res) {
        var item = res.data
        var favoritedBy = item.favoritedBy || []
        var alreadyFavorited = favoritedBy.indexOf(userId) > -1

        if (alreadyFavorited) {
          // 取消收藏
          var newFavoritedBy = favoritedBy.filter(function(id) { return id !== userId })
          return db.collection('treehole_messages').doc(msgId).update({
            data: { favoritedBy: newFavoritedBy }
          })
          .then(function() {
            self.toggleFavoriteState(msgId, false)
            wx.hideLoading()
            wx.showToast({ title: '已取消收藏', icon: 'success' })
          })
        } else {
          // 添加收藏，永久保存
          var permanentExpire = new Date('2099-12-31').getTime()
          favoritedBy.push(userId)
          return db.collection('treehole_messages').doc(msgId).update({
            data: {
              favoritedBy: favoritedBy,
              expireTime: permanentExpire
            }
          })
          .then(function() {
            self.toggleFavoriteState(msgId, true)
            wx.hideLoading()
            wx.showToast({ title: '收藏成功，永久保存', icon: 'success' })
          })
        }
      })
      .catch(function(err) {
        wx.hideLoading()
        console.error('收藏操作失败:', err)
        wx.showToast({ title: '操作失败', icon: 'none' })
      })
  },

  toggleFavoriteState: function(msgId, hasFavorited) {
    var list = this.data.messageList.map(function(msg) {
      if (msg.msgId === msgId) {
        msg.hasFavorited = hasFavorited
        msg.isExpired = false
      }
      return msg
    })
    this.setData({ messageList: list })
  },

  handleShare: function(e) {
    var item = this.data.messageList[e.currentTarget.dataset.index]
    if (!item) return

    wx.showShareMenu({ withShareTicket: true })
    wx.shareAppMessage({
      title: item.anonymousName + ' 说：' + item.content.substring(0, 20),
      path: '/pages/index/index'
    })
  },

  loadMore: function() {
    if (!this.data.hasMore) return
    this.loadMessages()
  },

  getRemainingText: function(expireTime, favoritedBy, userId) {
    if (!expireTime) return ''
    if (favoritedBy && favoritedBy.indexOf(userId) > -1) return '永久保存'
    var diff = expireTime - Date.now()
    if (diff <= 0) return '已过期'
    if (diff < 3600000) return '剩余' + Math.ceil(diff / 60000) + '分钟'
    if (diff < 86400000) return '剩余' + Math.ceil(diff / 3600000) + '小时'
    return '剩余' + Math.ceil(diff / 86400000) + '天'
  },

  formatTime: function(timestamp) {
    var date = new Date(timestamp)
    var now = new Date()
    var diff = now.getTime() - date.getTime()

    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
    if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
    if (diff < 604800000) return Math.floor(diff / 86400000) + '天前'

    var month = date.getMonth() + 1
    var day = date.getDate()
    return month + '月' + day + '日'
  },

  onShareAppMessage: function() {
    return {
      title: '校园树洞 - 分享你的心声，倾听他人故事',
      path: '/pages/index/index'
    }
  }
})
