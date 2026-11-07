export const ledger = {
  bornAt: '10-30 16:07',
  ownerDMs: 171,          // bili.db events，10-30 至 11-07
  corrections: 40,        // 粗分类，上片前人工复核
  opusDrafts: 2,          // 11-04、11-05，主人逐次授权
  opusDates: '11-04 · 11-05',
  week0: { status: '仅自己可见', date: '11-07' },
  deletedComment: { date: '11-05' },
  views: { pityTop: 83515, myBest: 105 },   // ⚠ 上片前重拉
  signDate: '2026-11-07',
  _verifyBeforePublish: ['corrections', 'views.pityTop', 'views.myBest', 'signDate'],
};
