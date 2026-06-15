const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

// 获取用户 openid
const getOpenId = async () => {
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 创建树洞所需集合
const createCollection = async () => {
  try {
    await db.createCollection("treehole_messages");
    await db.createCollection("treehole_likes");
    return {
      success: true,
      data: "create collection success",
    };
  } catch (e) {
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询留言列表（过滤已过期）
const selectRecord = async () => {
  const now = Date.now();
  return await db.collection("treehole_messages")
    .where({
      expireTime: db.command.gt(now),
    })
    .orderBy("createTime", "desc")
    .get();
};

// 更新留言数据
const updateRecord = async (event) => {
  try {
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("treehole_messages")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            likeCount: event.data[i].likeCount,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增留言
const insertRecord = async (event) => {
  try {
    const record = event.data;
    await db.collection("treehole_messages").add({
      data: {
        content: record.content,
        anonymousName: record.anonymousName,
        likeCount: 0,
        createTime: record.createTime || Date.now(),
        expireTime: record.expireTime || Date.now() + 24 * 3600 * 1000,
        userId: record.userId,
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除留言
const deleteRecord = async (event) => {
  try {
    await db
      .collection("treehole_messages")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
  }
};
