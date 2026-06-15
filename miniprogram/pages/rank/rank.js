const db = wx.cloud.database()

Page({
  data: {
    rankList: []
  },

  onLoad() {
    this.loadRankList()
  },

  onShow() {
    this.loadRankList()
  },

  loadRankList() {
    const now = Date.now()
    db.collection('treehole_messages')
      .where({
        expireTime: db.command.gt(now),
        likeCount: db.command.gt(0)
      })
      .orderBy('likeCount', 'desc')
      .get().then(res => {
        const list = res.data.map(item => ({
          ...item,
          likeCount: item.likeCount || 0
        }))
        this.setData({ rankList: list })
      }).catch(err => {
        console.error('加载排行榜失败:', err)
      })
  },

  onShareAppMessage() {
    return {
      title: '校园树洞 - 点赞排行榜，看看谁最受欢迎',
      path: '/pages/rank/rank'
    }
  }
})
