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
    db.collection('treehole_messages')
      .orderBy('likeCount', 'desc')
      .where({
        likeCount: db.command.gt(0)
      })
      .get().then(res => {
        const list = res.data.map(item => ({
          ...item,
          likeCount: item.likeCount || 0
        }))
        this.setData({ rankList: list })
      }).catch(err => {
        console.error('加载排行榜失败:', err)
      })
  }
})