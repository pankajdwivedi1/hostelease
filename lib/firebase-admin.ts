import * as admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: "hostelease-81056",
      privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCcdoBkukUhRI5u\nyHRXWq4TsJIrKxvf+zXsDDPeldH7utHI/Up9cQLT7DRk6+Q/efqik2Se7CsINgf0\nmY7f0G6kxURGh+rGGEKx08fnpOsOY6IEDUG12uZRtI1DNKR3Q6v1kupm5R0FGWV1\nzEIQVtmQd8ccSuCDDko5X6VFIqI2MIqE7q6aCMMDR5m7rAkbVWwuDRFJF8oS4g72\nWcLq7lvMbyHDDal5EUfQ2MLGZ/fDB0m/LNww6BABinvyyzVS/cj09QdCJsSCZ686\n3Jj2oLB926QR9w8nlQpCXu7LP6Rn+Secef3T2PdJ6+M9MC5PVLDPOn+69O+lcSX8\nklpbRJgdAgMBAAECggEADlLj8LTD0OadkoNL8VZWIuvSidyttdzh5Bz+36UAHwdM\nntWfbOn8bAnPByE4WV5RpXIQb2MoEl2d71TiiVdj1bZQiJN3WRDOBEki3zBQK5ZP\n9gZ/qkYiuT6qAwnN97QsiTQcvPRDKp0XVogvUR8eVlU813h8YssbXPLGZtSjnInC\n8gmcTopoHYbKHLXWDk/cqw++EkDddir9NCNSwWF9Nb6z5ApzLdFSBGrIlzEUQzud\nbDdDTrTusUaItWWOXfb2lYrxqphRTqijAxXadu3+7kAI4togllumKE/onsUIZqWx\n25xwMyfbOfUxYzmmYaljgeFzG28ewOQuA7rDa8pwqQKBgQDL4xPirsUUtkGCHSGi\nlvXgvvFH/Lm7kttKTYcvoBRi16fn2yKhJPTMGNpiLiQKzSxmr6fnv2axnfgZOD/g\ntjEOEbDOEmaDzZPIngsuTLY+5NNtYGh8jvQ9P/UHPu1OzQ50te5bV93dAY2cWtfZ\n3NRRwaZN5xNhoRTJdjzAmB2ImQKBgQDEdFM2q0NlmMDxL4p2uYqmvAL1Ulf9EZIT\nUvDEkNPzzfxU+rWtS3Bdpg9hX+HlljVQ6vHPzZsJv0nkhLTrxnZIHADv3qvD8eDE\nzIxl+ALriKCmydWupAKxNmx3rK3Z1m9ofALTj0Z4iNf+xynkMdNty05TWUN7Q4YK\ntj07A8TqJQKBgELwmh3JvcEQGa/repiUMcQJTNSSwDQ6gi8CB0l2qFrPbTwtcVAw\n/wJngoPLnF/DfzlzoI/xAnl8YPF+y1Iu3yo8Wq0901Sg0U2Dvi4EV62MmXIGvidv\nE/dsITmwyl8d6godlVV+IsSl9uWH2eiYnUj+aGiZXn6mUVnXrRiamM+5AoGBAKy/\n0ZCoJvrGyRsNAAgIfdjCSSOqBf9eHQJrE5b197tS7clYMLuzM5rV9H5ezwiQ/k8q\nWfquRN/cWsDcxS7y9H3SSiyjtIz4O/syF19vKDoviX1AzGrmhAuK3PSbXsDIZG0P\nZ3jba0+AndbHEZo9Cjto5HY8by+MH+l5ePxVAyoVAoGBAIuVo31haHCuxz+K+aIk\nlOOs/j2AkPf/dXvPqiP04a2qMaqxXsNwsEofcGAUkXX/qyxKthabtvmUC+FQy92Z\nGwK/Hh3V9kPwv/ZQq95BhzKPwDtMSG5zzRUB/B3K6Vhk7k/7/SgdoFlP4abRwbME\n6ReaVALFnBk0sdhUzCRqDLAK\n-----END PRIVATE KEY-----\n",
      clientEmail: "firebase-adminsdk-fbsvc@hostelease-81056.iam.gserviceaccount.com",
    }),
  });
}

export const adminAuth = admin.auth();
export default admin;

