const AWS = require('aws-sdk');
const translate = new AWS.Translate();

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
    };

    // Handle preflight request
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: headers,
            body: ''
        };
    }

    try {
        // Parse request body
        const body = JSON.parse(event.body);
        const { text, sourceLanguage, targetLanguage } = body;
        
        // Handle auto-detect
        let actualSourceLanguage = sourceLanguage;
        if (sourceLanguage === 'auto') {
            actualSourceLanguage = 'en'; // Default to English for auto
        }

        // Don't translate if same language
        if (actualSourceLanguage === targetLanguage) {
            return {
                statusCode: 200,
                headers: headers,
                body: JSON.stringify({
                    translatedText: text,
                    sourceLanguage: actualSourceLanguage,
                    targetLanguage: targetLanguage,
                    confidence: 1.0
                })
            };
        }

        // Call AWS Translate
        const params = {
            Text: text,
            SourceLanguageCode: actualSourceLanguage,
            TargetLanguageCode: targetLanguage
        };
        
        const result = await translate.translateText(params).promise();
        
        return {
            statusCode: 200,
            headers: headers,
            body: JSON.stringify({
                translatedText: result.TranslatedText,
                sourceLanguage: result.SourceLanguageCode,
                targetLanguage: targetLanguage,
                confidence: 0.95
            })
        };
        
    } catch (error) {
        console.error('Translation error:', error);
        return {
            statusCode: 500,
            headers: headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};