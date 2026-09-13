/**
 * Telegram API 封装类
 */
export class TelegramAPI {
    constructor(botToken, proxyUrl = '') {
        this.botToken = botToken;
        // 后台配置既可能填写域名，也可能误填完整 URL；统一规范化，避免 https://https://...
        this.proxyUrl = String(proxyUrl || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
        // 如果设置了代理域名，使用代理域名，否则使用官方 API
        const apiDomain = this.proxyUrl ? `https://${this.proxyUrl}` : 'https://api.telegram.org';
        this.baseURL = `${apiDomain}/bot${this.botToken}`;
        this.fileDomain = apiDomain;
        this.defaultHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0"
        };
    }

    /**
     * 发送文件到Telegram
     * @param {File} file - 要发送的文件
     * @param {string} chatId - 聊天ID
     * @param {string} functionName - API方法名（如：sendPhoto, sendDocument等）
     * @param {string} functionType - 文件类型参数名（如：photo, document等）
     * @returns {Promise<Object>} API响应结果
     */
    async sendFile(file, chatId, functionName, functionType, caption = '', fileName = '') {
        if (!this.botToken) {
            throw new Error('Telegram Bot Token is missing');
        }
        if (!chatId) {
            throw new Error('Telegram Chat ID is missing');
        }

        const formData = new FormData();

        formData.append('chat_id', chatId);
        if (fileName) {
            formData.append(functionType, file, fileName);
        } else {
            formData.append(functionType, file);
        }
        if (caption) {
            formData.append('caption', caption);
        }

        const response = await fetch(`${this.baseURL}/${functionName}`, {
            method: 'POST',
            headers: this.defaultHeaders,
            body: formData
        });
        console.log('Telegram API response:', response.status, response.statusText);

        let responseData = null;
        try {
            responseData = await response.json();
        } catch {
            // 某些代理可能返回非 JSON 错误页，下面使用 HTTP 状态生成可读错误。
        }

        if (!response.ok || !responseData?.ok) {
            const description = responseData?.description
                || `${response.status} ${response.statusText}`.trim()
                || 'Unknown Telegram API error';
            throw new Error(`Telegram API error: ${description}`);
        }

        return responseData;
    }

    /**
     * 获取文件信息
     * @param {Object} responseData - Telegram API响应数据
     * @returns {Object|null} 文件信息对象或null
     */
    getFileInfo(responseData) {
        const getFileDetails = (file) => ({
            file_id: file.file_id,
            file_name: file.file_name || file.file_unique_id,
            file_size: file.file_size,
        });

        try {
            if (!responseData.ok) {
                console.error('Telegram API error:', responseData.description);
                return null;
            }

            if (responseData.result.photo) {
                const largestPhoto = responseData.result.photo.reduce((prev, current) =>
                    (prev.file_size > current.file_size) ? prev : current
                );
                return getFileDetails(largestPhoto);
            }

            if (responseData.result.video) {
                return getFileDetails(responseData.result.video);
            }

            if (responseData.result.audio) {
                return getFileDetails(responseData.result.audio);
            }

            if (responseData.result.document) {
                return getFileDetails(responseData.result.document);
            }

            return null;
        } catch (error) {
            console.error('Error parsing Telegram response:', error.message);
            return null;
        }
    }

    /**
     * 获取文件路径
     * @param {string} fileId - 文件ID
     * @returns {Promise<string|null>} 文件路径或null
     */
    async getFilePath(fileId) {
        try {
            const url = `${this.baseURL}/getFile?file_id=${fileId}`;
            const response = await fetch(url, {
                method: 'GET',
                headers: this.defaultHeaders,
            });

            let responseData = null;
            try {
                responseData = await response.json();
            } catch {
                // 在下面用 HTTP 状态返回可读错误。
            }

            if (!response.ok || !responseData?.ok) {
                const description = responseData?.description
                    || `${response.status} ${response.statusText}`.trim()
                    || 'Unknown Telegram getFile error';
                throw new Error(`Telegram getFile error: ${description}`);
            }

            return responseData.result?.file_path || null;
        } catch (error) {
            console.error('Error getting file path:', error.message);
            throw error;
        }
    }

    /**
     * 获取文件内容
     * @param {string} fileId - 文件ID
     * @returns {Promise<Response>} 文件响应
     */
    async getFileContent(fileId) {
        const filePath = await this.getFilePath(fileId);
        if (!filePath) {
            throw new Error(`File path not found for fileId: ${fileId}`);
        }

        const fullURL = `${this.fileDomain}/file/bot${this.botToken}/${filePath}`;
        const response = await fetch(fullURL, {
            headers: this.defaultHeaders
        });

        return response;
    }

}