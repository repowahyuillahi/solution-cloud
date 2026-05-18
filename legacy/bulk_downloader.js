const axios = require('axios');
const xlsx = require('xlsx');
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const path = require('path');

// ================= CONFIGURATION =================
const ODS_FILE_PATH = path.join(__dirname, '..', 'Fingerprint (Update 04 Juni 2022).ods');
const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRwxwVb4bfdRUViGlkMYzJpCpkAKF0f-c8YWgFMOVkMj-UzQXp_lo96KKGjtLHeKs_H1HgOdCpU_f_I/pub?gid=0&single=true&output=csv";
const BASE_URL = "http://solutioncloud.co.id/view.asp";
const REPORT_FILE = "Laporan_Absensi_All.csv";
const CONCURRENCY = 5; // Berapa mesin didownload bersamaan
// =================================================

// 1. Fetch Google Sheet Karyawan Map
async function fetchKaryawanMap() {
    console.log("📥 Mengambil daftar karyawan dari Google Sheets...");
    const map = {};
    try {
        const res = await axios.get(GOOGLE_SHEET_CSV_URL);
        const lines = res.data.trim().split('\n');
        lines.forEach((line, index) => {
            if (index === 0) return;
            const parts = line.split(',');
            const kode = parts[0] ? parts[0].trim().replace(/"/g, '') : '';
            const nama = parts[1] ? parts[1].trim().replace(/"/g, '') : '';
            if (kode && nama) map[kode] = nama;
        });
        console.log(`✅ Berhasil memuat ${Object.keys(map).length} karyawan.`);
    } catch (error) {
        console.error("❌ Gagal mengambil Google Sheets:", error.message);
    }
    return map;
}

// 2. Read Devices from ODS
function getDevicesFromODS() {
    console.log("\n📖 Membaca file Excel/ODS...");
    if (!fs.existsSync(ODS_FILE_PATH)) {
        console.error(`❌ File tidak ditemukan: ${ODS_FILE_PATH}`);
        process.exit(1);
    }

    const workbook = xlsx.readFile(ODS_FILE_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Convert to 2D array
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    const devices = [];
    // Skip header (index 0)
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 5) continue;
        
        const no = row[0];
        const kode_dealer = row[1] ? row[1].toString().trim() : '';
        const nama_dealer = row[2] ? row[2].toString().trim() : '';
        const sn = row[3] ? row[3].toString().trim() : '';
        const pwd = row[4] ? row[4].toString().trim() : 'solution';

        if (sn && pwd) {
            devices.push({ kode_dealer, nama_dealer, sn, pwd });
        }
    }
    console.log(`✅ Ditemukan ${devices.length} mesin fingerprint.`);
    return devices;
}

// 3. Fetch Data for a single device
async function fetchDeviceData(device) {
    try {
        const url = `${BASE_URL}?sn=${device.sn}&pwd=${device.pwd}`;
        const res = await axios.get(url, { timeout: 15000 });
        
        let textData = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
        // Clean HTML tags and normalisasi spasi/enter
        textData = textData.replace(/<[^>]+>/g, '\n').replace(/\r/g, '');

        const regex = /^(\d{4,6})\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(\d)\s+(\d)\s+(\d)/;
        const rows = [];
        
        textData.split('\n').forEach(line => {
            const match = line.trim().match(regex);
            if (match) {
                rows.push({
                    kode: match[1],
                    tanggal: match[2],
                    waktu: match[3],
                    c1: match[4],
                    c2: match[5],
                    c3: match[6],
                    // extra context
                    kode_dealer: device.kode_dealer,
                    nama_dealer: device.nama_dealer
                });
            }
        });
        
        return { success: true, device, rows };
    } catch (e) {
        return { success: false, device, error: e.message, rows: [] };
    }
}

// 4. Main Process
async function main() {
    const karyawanMap = await fetchKaryawanMap();
    const devices = getDevicesFromODS();

    if (devices.length === 0) {
        console.log("Tidak ada mesin untuk diproses.");
        return;
    }

    console.log(`\n🚀 Mulai proses download absensi dari ${devices.length} mesin (Bisa memakan waktu beberapa saat)...\n`);
    
    let allAbsensiRaw = [];
    let successCount = 0;
    let failCount = 0;

    // Process in chunks (Concurrency)
    for (let i = 0; i < devices.length; i += CONCURRENCY) {
        const chunk = devices.slice(i, i + CONCURRENCY);
        const promises = chunk.map(d => fetchDeviceData(d));
        
        const results = await Promise.all(promises);
        results.forEach(res => {
            if (res.success) {
                console.log(`[OK]   ${res.device.kode_dealer.padEnd(10)} | ${res.device.nama_dealer.substring(0,25).padEnd(25)} | Ditemukan ${res.rows.length} logs`);
                allAbsensiRaw.push(...res.rows);
                successCount++;
            } else {
                console.log(`[FAIL] ${res.device.kode_dealer.padEnd(10)} | ${res.device.nama_dealer.substring(0,25).padEnd(25)} | Error: ${res.error}`);
                failCount++;
            }
        });
    }

    console.log(`\n🎉 Proses Selesai! Berhasil: ${successCount}, Gagal: ${failCount}`);
    console.log(`🔄 Menggabungkan dan merangkum total ${allAbsensiRaw.length} raw logs...`);

    // Grouping into summary (Jam Masuk, Jam Pulang)
    const grouped = {};
    allAbsensiRaw.forEach(r => {
        const key = r.kode_dealer + '|' + r.kode + '|' + r.tanggal;
        if (!grouped[key]) {
            grouped[key] = {
                kode_dealer: r.kode_dealer,
                nama_dealer: r.nama_dealer,
                kode_karyawan: r.kode,
                nama_karyawan: karyawanMap[r.kode] || '⚠️ Tidak ditemukan',
                tanggal: r.tanggal,
                times: []
            };
        }
        grouped[key].times.push(r.waktu);
    });

    const finalReport = Object.values(grouped).map(g => {
        g.times.sort();
        return {
            kode_dealer: g.kode_dealer,
            nama_dealer: g.nama_dealer,
            tanggal: g.tanggal,
            kode_karyawan: g.kode_karyawan,
            nama_karyawan: g.nama_karyawan,
            masuk: g.times[0] || '-',
            pulang: g.times.length > 1 ? g.times[g.times.length - 1] : '-',
            total_tap: g.times.length
        };
    });

    // Urutkan berdasarkan dealer -> tanggal -> nama karyawan
    finalReport.sort((a, b) => 
        a.kode_dealer.localeCompare(b.kode_dealer) || 
        a.tanggal.localeCompare(b.tanggal) || 
        a.nama_karyawan.localeCompare(b.nama_karyawan)
    );

    // Save to CSV
    console.log(`💾 Menyimpan Laporan ke ${REPORT_FILE}...`);
    const csvWriter = createObjectCsvWriter({
        path: REPORT_FILE,
        header: [
            { id: 'kode_dealer', title: 'Kode Dealer' },
            { id: 'nama_dealer', title: 'Nama Dealer' },
            { id: 'tanggal', title: 'Tanggal' },
            { id: 'kode_karyawan', title: 'Kode Karyawan' },
            { id: 'nama_karyawan', title: 'Nama Karyawan' },
            { id: 'masuk', title: 'Jam Masuk' },
            { id: 'pulang', title: 'Jam Pulang' },
            { id: 'total_tap', title: 'Total Tap' }
        ]
    });

    await csvWriter.writeRecords(finalReport);
    console.log(`✅ Laporan berhasil disimpan di: ${path.resolve(REPORT_FILE)}`);
    console.log(`✨ Total Record Akhir (Unik per Karyawan/Hari): ${finalReport.length}`);
}

main();
