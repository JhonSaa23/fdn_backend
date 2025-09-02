const axios = require('axios');

async function testStockPDF() {
    try {
        console.log('🧪 Probando endpoint de stock PDF...');
        
        const response = await axios.get('http://localhost:3023/api/bot/stock-completo-pdf/89', {
            responseType: 'stream',
            timeout: 30000
        });
        
        console.log('✅ Respuesta exitosa:', response.status);
        console.log('📊 Headers:', response.headers);
        
        // Guardar el PDF en un archivo para verificar
        const fs = require('fs');
        const writer = fs.createWriteStream('test-stock-output.pdf');
        
        response.data.pipe(writer);
        
        writer.on('finish', () => {
            console.log('✅ PDF guardado como test-stock-output.pdf');
        });
        
        writer.on('error', (error) => {
            console.error('❌ Error guardando PDF:', error);
        });
        
    } catch (error) {
        console.error('❌ Error en la prueba:', error.message);
        if (error.response) {
            console.error('📊 Status:', error.response.status);
            console.error('📊 Data:', error.response.data);
        }
    }
}

testStockPDF();
