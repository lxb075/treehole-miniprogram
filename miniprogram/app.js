// app.js - 全局应用入口
const { getAnimalAvatar } = require('./utils/animal.js')

App({
  onLaunch: function () {
    // 初始化全局数据
    this.globalData = {
      // 云开发环境ID - 请改为你的云开发环境 ID
      env: "cloud1-d4gw735pud871dfd3",
      // 用户身份信息(后续通过 login/setUserProfile 填充)
      openid: '',
      userInfo: null,
      // 是否已授权真实信息(头像昵称)
      hasProfile: false,
      // 生成随机匿名代号
      generateAnonymousName: () => {
        const adjectives = ['快乐的', '神秘的', '勇敢的', '聪明的', '温柔的', '活泼的', '安静的', '可爱的', '酷酷的', '萌萌的'];
        const nouns = ['小猫', '小狗', '熊猫', '兔子', '狐狸', '小鹿', '考拉', '企鹅', '海豚', '松鼠'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 1000);
        return `${adj}${noun}${num}`;
      },
      // 本地稳定的设备 ID(仅用于点赞/收藏防重复)
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

    // 读取本地缓存的用户信息
    try {
      const cached = wx.getStorageSync('treehole_user_info');
      if (cached) {
        this.globalData.userInfo = cached;
        this.globalData.hasProfile = true;
      }
      const cachedOpenid = wx.getStorageSync('treehole_openid');
      if (cachedOpenid) {
        this.globalData.openid = cachedOpenid;
      }
    } catch (e) {
      console.warn('读取本地用户信息失败', e);
    }

    // 自动静默登录,获取 openid
    this.silentLogin();
  },

  /**
   * 静默登录:调用 wx.login + 云函数,获取 openid
   * 不会弹任何授权框
   */
  silentLogin() {
    wx.login({
      success: res => {
        if (!res.code) {
          console.warn('wx.login 失败,无法获取 code');
          return;
        }
        // 通过云函数换取 openid
        wx.cloud.callFunction({
          name: 'quickstartFunctions',
          data: { action: 'getOpenId' }
        }).then(resp => {
          const openid = resp && resp.result && resp.result.openid;
          if (openid) {
            this.globalData.openid = openid;
            wx.setStorageSync('treehole_openid', openid);
            console.log('静默登录成功,openid 已缓存');
          }
        }).catch(err => {
          console.warn('获取 openid 失败(可能未部署云函数):', err);
        });
      },
      fail: err => {
        console.warn('wx.login 失败:', err);
      }
    });
  },

  /**
   * 主动授权:弹窗获取用户昵称、头像
   * 成功后将信息写入 globalData + 本地缓存
   * 返回 Promise<userInfo | null>
   */
  authorizeUserProfile() {
    return new Promise((resolve) => {
      wx.getUserProfile({
        desc: '用于在树洞中展示你的头像和昵称',
        success: res => {
          const info = res.userInfo || {};
          this.globalData.userInfo = info;
          this.globalData.hasProfile = true;
          wx.setStorageSync('treehole_user_info', info);
          // 同步到云端 users 集合
          this.syncUserProfile(info).catch(e => console.warn('同步用户信息失败', e));
          resolve(info);
        },
        fail: err => {
          console.warn('用户拒绝授权:', err);
          resolve(null);
        }
      });
    });
  },

  /**
   * 同步用户信息到云端 users 集合
   * 用 openid 作为唯一标识,不存在则新增
   */
  syncUserProfile(userInfo) {
    const db = wx.cloud.database();
    const openid = this.globalData.openid;
    if (!openid) return Promise.resolve();

    return db.collection('treehole_users').where({ _openid: openid }).get().then(res => {
      if (res.data && res.data.length > 0) {
        // 已存在,更新昵称头像
        return db.collection('treehole_users').doc(res.data[0]._id).update({
          data: {
            nickName: userInfo.nickName || '',
            avatarUrl: userInfo.avatarUrl || '',
            updateTime: Date.now()
          }
        });
      } else {
        // 新增
        return db.collection('treehole_users').add({
          data: {
            nickName: userInfo.nickName || '',
            avatarUrl: userInfo.avatarUrl || '',
            createTime: Date.now(),
            updateTime: Date.now()
          }
        });
      }
    });
  },

  /**
   * 获取当前用户的展示信息(头像 + 昵称)
   * 已授权则用真实信息,未授权则用 q版动物 + 匿名代号
   */
  getDisplayUser() {
    const info = this.globalData.userInfo;
    const openid = this.globalData.openid;
    if (info && this.globalData.hasProfile) {
      const animal = getAnimalAvatar(info.nickName || openid);
      return {
        nickName: info.nickName || '树洞朋友',
        avatarUrl: info.avatarUrl || '',
        animal,
        isReal: true
      };
    }
    // 未授权,使用匿名动物头
    const name = this.globalData.generateAnonymousName();
    const animal = getAnimalAvatar(openid || name);
    return {
      nickName: name,
      avatarUrl: '',
      animal,
      isReal: false
    };
  }
});
