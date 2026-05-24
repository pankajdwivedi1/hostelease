export async function sendMSG91_OTP(phoneNumber: string, otp: string) {
    try {
        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_TEMPLATE_ID_OTP;

        if (!authKey || !templateId) {
            console.warn("⚠️ MSG91 AuthKey or TemplateID is missing. Running in DEV mode (OTP will not be sent to MSG91).");
            return { success: false, error: "Configuration missing" };
        }

        // Clean phone number (remove +91 if exists for raw processing, MSG91 expects mobile with country code usually, 
        // standard is 91XXXXXXXXXX)
        let cleanedPhone = phoneNumber.replace(/\D/g, "");
        if (cleanedPhone.length === 10) {
            cleanedPhone = "91" + cleanedPhone;
        }

        const url = `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=${cleanedPhone}&otp=${otp}`;

        const options = {
            method: 'GET',
            headers: {
                accept: 'application/json',
                authkey: authKey
            }
        };

        const response = await fetch(url, options);
        const data = await response.json();

        if (data.type === "success") {
            console.log(`✅ [MSG91] OTP SMS sent successfully to ${cleanedPhone}`);
            return { success: true, data };
        } else {
            console.error(`❌ [MSG91] Error sending OTP:`, data);
            return { success: false, error: data.message };
        }
    } catch (error: any) {
        console.error("❌ [MSG91] Exception in sendMSG91_OTP:", error);
        return { success: false, error: error.message };
    }
}

export async function sendMSG91_GatepassAlert(
    phoneNumber: string,
    studentName: string,
    gateName: string,
    time: string,
    action: "out" | "in",
    collegeName: string
) {
    try {
        const authKey = process.env.MSG91_AUTH_KEY;
        const templateId = process.env.MSG91_TEMPLATE_ID_GATEPASS;

        if (!authKey || !templateId) {
            console.warn(`⚠️ MSG91 AuthKey or TemplateID missing. Simulating Gatepass SMS for ${studentName} (${action})`);
            return { success: false, error: "Configuration missing" };
        }

        let cleanedPhone = phoneNumber.replace(/\D/g, "");
        if (cleanedPhone.length === 10) {
            cleanedPhone = "91" + cleanedPhone; // Default to India
        }

        // Using generic var1, var2, var3 to perfectly match the 3 {#var#}s in your approved DLT template:
        // {#var1#} = studentName
        // {#var2#} = time
        // {#var3#} = collegeName (e.g. OGI BHOPAL)
        const payload = {
            template_id: templateId,
            short_url: "0",
            recipients: [
                {
                    mobiles: cleanedPhone,
                    var1: studentName,
                    var2: time,
                    var3: collegeName
                }
            ]
        };

        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authkey: authKey
            },
            body: JSON.stringify(payload)
        };

        const response = await fetch('https://control.msg91.com/api/v5/flow/', options);
        const data = await response.json();

        if (data.type === "success" || data.type === "success ") {
            console.log(`✅ [MSG91] Gatepass Alert SMS sent to ${cleanedPhone} for ${studentName}`);
            return { success: true, data };
        } else {
            console.error(`❌ [MSG91] Error sending Gatepass Alert:`, data);
            return { success: false, error: data.message };
        }
    } catch (error: any) {
        console.error("❌ [MSG91] Exception in sendMSG91_GatepassAlert:", error);
        return { success: false, error: error.message };
    }
}

export async function sendMSG91_WidgetOTP(phoneNumber: string) {
    try {
        const authKey = process.env.MSG91_AUTH_KEY;
        const widgetId = process.env.MSG91_WIDGET_ID;

        if (!authKey || !widgetId) {
            console.warn("⚠️ MSG91 AuthKey or WidgetID is missing. Simulating Widget OTP.");
            return { success: false, error: "Configuration missing", reqId: "simulated_req_id" };
        }

        let cleanedPhone = phoneNumber.replace(/\D/g, "");
        if (cleanedPhone.length === 10) {
            cleanedPhone = "91" + cleanedPhone;
        }

        const payload = {
            widgetId: widgetId,
            identifier: cleanedPhone
        };

        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authkey: authKey
            },
            body: JSON.stringify(payload)
        };

        const response = await fetch('https://api.msg91.com/api/v5/widget/sendOtp', options);
        const data = await response.json();

        if (data.type === "success") {
            console.log(`✅ [MSG91 WIDGET] OTP requested successfully for ${cleanedPhone}. ReqId: ${data.message}`);
            // The actual request ID is usually returned in data.message
            return { success: true, reqId: data.message };
        } else {
            console.error(`❌ [MSG91 WIDGET] Error sending OTP:`, data);
            return { success: false, error: data.message };
        }
    } catch (error: any) {
        console.error("❌ [MSG91 WIDGET] Exception in sendMSG91_WidgetOTP:", error);
        return { success: false, error: error.message };
    }
}

export async function verifyMSG91_WidgetOTP(phoneNumber: string, reqId: string, otp: string) {
    try {
        const authKey = process.env.MSG91_AUTH_KEY;
        const widgetId = process.env.MSG91_WIDGET_ID;

        if (!authKey || !widgetId) {
            console.warn("⚠️ MSG91 AuthKey or WidgetID is missing. Simulating Verification.");
            return { success: true };
        }

        let cleanedPhone = phoneNumber.replace(/\D/g, "");
        if (cleanedPhone.length === 10) {
            cleanedPhone = "91" + cleanedPhone;
        }

        const payload = {
            widgetId: widgetId,
            reqId: reqId,
            otp: otp
        };

        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                authkey: authKey
            },
            body: JSON.stringify(payload)
        };

        const response = await fetch('https://api.msg91.com/api/v5/widget/verifyOtp', options);
        const data = await response.json();

        if (data.type === "success") {
            console.log(`✅ [MSG91 WIDGET] OTP verified successfully for ${cleanedPhone}`);
            return { success: true };
        } else {
            console.warn(`⚠️ [MSG91 WIDGET] OTP verification failed for ${cleanedPhone}:`, data);
            return { success: false, error: data.message || "Invalid OTP" };
        }
    } catch (error: any) {
        console.error("❌ [MSG91 WIDGET] Exception in verifyMSG91_WidgetOTP:", error);
        return { success: false, error: error.message };
    }
}
