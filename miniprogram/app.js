App({
  onLaunch: function () {
    // 初始化全局数据
    this.globalData = {
      // 云开发环境ID - 已配置
      env: "cloud1-d4gw735pud871dfd3",
      // 生成随机匿名代号
      generateAnonymousName: () => {
        const adjectives = ['快乐的', '神秘的', '勇敢的', '聪明的', '温柔的', '活泼的', '安静的', '可爱的', '酷酷的', '萌萌的'];
        const nouns = ['小猫', '小狗', '熊猫', '兔子', '狐狸', '小鹿', '考拉', '企鹅', '海豚', '松鼠'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 1000);
        return `${adj}${noun}${num}`;
      },
      // 本地存储的用户匿名标识（用于防重复点赞）
      getUserId: () => {
        let userId = wx.getStorageSync('treehole_user_id');
        if (!userId) {
          userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
          wx.setStorageSync('treehole_user_id', userId);
        }
        return userId;
      }
    };

    // 初始化云开发
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },

  globalData: {}
});
