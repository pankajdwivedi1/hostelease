import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "hostelease-95fd7",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDPK3iL5x66qRCe\nPZ5P+hsCH3fpmhiw40Qy3gsLDw8l9NjCdq+KHWUNnl3400ZVrPj5+8CcZ/4yLTps\nFB6Z8BP2wM4r9CMW3E8t1bPhJjaS534Lh3bkhreaO34UnUyYNYifgkOhqiC7rOCl\nY2j/0VjBdVuor8sdX9m/WHaCRnssz6rSFE1c+L8Ptsik8hH8JbDEtEz0ezugHV8d\nmxeJmA9ose8+CWS/Strzur555D6be5LDGnVE0w+ukxRpWxRsCiojBc5vcT8JrgAf\nIoErQW+/QwulWVUZF8DLF6vp5vn5Z4BiPEBKCOvk5q2bIm+WuN14ZuEQubXwTvCw\neiHxAJqzAgMBAAECggEAKXqBKLWuC95ksuIQa9/d/3dQeWd+cRAXq/2UBXNO66ER\nsyGzNLp87JScKQEYEHhQ4zA6GLajiOVQUKpYlCaiwKFKxjcbvWx/t+QVH0uY2qHZ\ntTI6pjeo1Ar8S+FQoBr7zz/0DY6z/g93bPWx5KJEHHvETcpgpvF1dd+e3qeA6vAO\noSJ42F5M+E6vUz+DjXCGMLADUEBEu9w71vHnZf/+UvQ4uB8ebJbeAe4cY3xL4Mv3\nch3fLULiO18Kk7sMypaqFqjUKBmI3tPw8gfbVIl6dBc/0o1yU/n68afN0hjyW6xI\npxLxrAXBou40V2V/Q1JwxVYRPeEVTVTHS0oExCw28QKBgQD8I23cx1C9akYx6lXD\nKR70/GbViFcALe/4X/naBtcOGlX58fT7AKf3tO3bwg32AdzP4ZJR0V79uvktZx2U\nW93Khkv2LK7RK0bED/PZnPv5wGoD4aLfJxm9Vunk5yn/mm2HyRoLVoug0TWSFn1Y\nyAEjOxYfvenyMvlKJjtoBgWxwwKBgQDSV7s1Yn0RcnyLugTHJKeNN7/S+kAhurdN\nubkdIEeMm7cf9/I4kNS5V4Rj30hXbQN/CJCmG0vjtT3z8sQv1eNfnZsDSplIgoZW\ngW+7kzYJ2bTjysAmVhyCVZAWq/tfKrna4KVAHwl9IEdjL5+kiAnzT338zPeFupUE\nNz5YP010UQKBgQDM2wBE88/exbzYi1s44G0dgQEQFuEQ7UHenCQFB6+s7qrSE8sG\nMIdIE8F53lW3fdXpNI3MWf8CyenwAKqgwm8WQDzxe2Zh3fZ2D7wBH7H+Pl4kXywU\ngNFB657HcyXFXbQGMdcuRRfXBoOu+QTIoF+EP1p/Wa79MHsoyp1TrCjuPwKBgHzH\nqrkqqgMVpajGO1tf9T2jGtqvtifMOj2Ttar/oTJalbITRtAjqu4gattMc//ZHb/Y\ndubzPnvg4tW66INwIShxuKmlMXWAaO0ccAoYdHA3hEW123NilhsDYyzv7XkxQXwE\n1ENLpjdiVLcUY2IZib2bJKQ5e4ULgKc1lniHZQ1hAoGBALrxodVXwrOfTOeQLw47\n+kN+XLAfPhxZeD7dImN+6mbafYvKcNHK7+Gzq6n+K4HLHQyYNws55BK0+/EGiIlM\nC7JadiVGiTllFhI2sIvucmLCmWveMPknhzcpS1MdtM7lcjBYSLuUfPk4pHykdyRR\ni5Gma6gvBIeJnIZzgJMoIwMf\n-----END PRIVATE KEY-----\n",
      clientEmail: "firebase-adminsdk-fbsvc@hostelease-95fd7.iam.gserviceaccount.com",
    }),
  });
}

export const adminAuth = admin.auth();
export default admin;

