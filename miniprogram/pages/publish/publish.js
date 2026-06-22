// pages/publish/publish.js - 发布树洞
const db = wx.cloud.database()
const app = getApp()
const { getAnimalAvatar } = require('../../utils/animal.js')

Page({
  data: {
    content: '',
    anonymousName: '',
    // 待上传图片本地临时路径
    imagePath: '',
    // 上传后的 fileID(写入数据库)
    imageFileID: '',
    // 是否正在上传图片
    isUploading: false,
    // 提交中
    isSubmitting: false,
    // 当前用户预览信息
    currentUser: null
  },

  onLoad() {
    this.refreshCurrentUser()
    this.generateAnonymousName()
  },

  onShow() {
    this.refreshCurrentUser()
  },

  // 刷新当前用户
  refreshCurrentUser() {
    const user = app.getDisplayUser()
    const animal = getAnimalAvatar(user.nickName)
    this.setData({
      currentUser: { ...user, animal }
    })
  },

  // 授权并刷新用户信息
  handleAuthorize() {
    wx.showLoading({ title: '登录中...', mask: true })
    app.authorizeUserProfile().then(info => {
      wx.hideLoading()
      if (info) {
        wx.showToast({ title: '登录成功', icon: 'success', duration: 1500 })
        this.refreshCurrentUser()
      } else {
        wx.showToast({ title: '已取消授权', icon: 'none' })
      }
    })
  },

  generateAnonymousName() {
    // 优先使用已授权昵称,否则生成随机
    const user = app.getDisplayUser()
    this.setData({ anonymousName: user.nickName })
  },

  // 换一个匿名(只有未授权时才能换)
  refreshName() {
    const name = app.globalData.generateAnonymousName()
    this.setData({ anonymousName: name })
  },

  handleInput(e) {
    this.setData({ content: e.detail.value })
  },

  // ==================== 图片选择与上传 ====================
  chooseImage() {
    if (this.data.imagePath) {
      // 已选择,允许删除
      this.setData({
        imagePath: '',
        imageFileID: ''
      })
      return
    }
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: res => {
        const file = res.tempFiles[0]
        if (!file) return
        this.setData({ imagePath: file.tempFilePath, isUploading: true })
        wx.showLoading({ title: '图片上传中...', mask: true })
        this.uploadImage(file.tempFilePath)
      },
      fail: err => {
        console.warn('选择图片取消/失败', err)
      }
    })
  },

  // 上传图片到云存储
  uploadImage(tempFilePath) {
    const ext = tempFilePath.match(/\.(\w+)$/)
    const cloudPath = `treehole-images/${Date.now()}-${Math.random().toString(36).substr(2, 6)}${ext ? ext[0] : '.jpg'}`
    wx.cloud.uploadFile({
      cloudPath,
      filePath: tempFilePath
    }).then(res => {
      this.setData({
        imageFileID: res.fileID,
        isUploading: false
      })
      wx.hideLoading()
      wx.showToast({ title: '图片上传成功', icon: 'success', duration: 1000 })
    }).catch(err => {
      console.error('图片上传失败:', err)
      this.setData({
        imagePath: '',
        imageFileID: '',
        isUploading: false
      })
      wx.hideLoading()
      wx.showToast({
        title: '图片上传失败,请检查网络后重试',
        icon: 'none',
        duration: 2000
      })
    })
  },

  // 预览图片
  previewImage() {
    if (!this.data.imagePath) return
    wx.previewImage({
      urls: [this.data.imagePath]
    })
  },

  // 浮动按钮:返回"我的"
  goMy() {
    wx.switchTab({ url: '/pages/my/my' })
  },

  // ==================== 发布 ====================
  handlePublish() {
    if (this.data.isSubmitting) return
    const { content, anonymousName, imageFileID } = this.data
    if (!content.trim()) {
      wx.showToast({ title: '请输入留言内容', icon: 'none' })
      return
    }
    if (this.data.isUploading) {
      wx.showToast({ title: '图片还在上传,请稍等', icon: 'none' })
      return
    }

    this.setData({ isSubmitting: true })
    wx.showLoading({ title: '发布中...', mask: true })

    const newMessage = {
      content: content.trim(),
      anonymousName,
      likeCount: 0,
      createTime: Date.now(),
      userId: app.globalData.getUserId()
    }
    if (imageFileID) newMessage.imageFileID = imageFileID

    // 5 秒超时保护
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('发布超时')), 8000)
    })

    Promise.race([
      db.collection('treehole_messages').add({ data: newMessage }),
      timeoutPromise
    ]).then(() => {
      wx.hideLoading()
      wx.showToast({ title: '发布成功', icon: 'success', duration: 1500 })
      this.setData({
        content: '',
        imagePath: '',
        imageFileID: '',
        isSubmitting: false
      })
      // 1.5 秒后跳回首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 1500)
    }).catch(err => {
      wx.hideLoading()
      this.setData({ isSubmitting: false })
      console.error('发布失败:', err)
      const errMsg = err.errMsg || err.message || '未知错误'
      const errCode = err.errCode !== undefined ? `(错误码:${err.errCode})` : ''
      wx.showModal({
        title: '发布失败,请重试',
        content: `${errMsg}${errCode}\n\n请检查:\n1. app.js 中云开发环境ID是否正确\n2. 是否已创建 treehole_messages 集合\n3. 网络是否正常`,
        showCancel: false,
        confirmText: '我知道了'
      })
    })
  }
})
