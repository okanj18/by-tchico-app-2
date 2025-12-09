
import React, { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Printer, Camera, AlertTriangle } from 'lucide-react';

// --- GENERATOR COMPONENT ---
interface QRGeneratorModalProps {
    isOpen: boolean;
    onClose: () => void;
    value: string;
    title: string;
    subtitle?: string;
    price?: number;
}

export const QRGeneratorModal: React.FC<QRGeneratorModalProps> = ({ isOpen, onClose, value, title, subtitle, price }) => {
    const qrRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handlePrint = () => {
        const printWindow = window.open('', '', 'width=400,height=400');
        if (!printWindow) return;

        const content = qrRef.current?.innerHTML;
        if (!content) return;

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Label</title>
                    <style>
                        body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif; }
                        .label { text-align: center; border: 2px dashed #333; padding: 20px; border-radius: 10px; width: 300px; }
                        h2 { margin: 10px 0 5px; font-size: 18px; }
                        p { margin: 0; font-size: 12px; color: #555; }
                        .price { font-size: 20px; font-weight: bold; margin-top: 10px; display: block; }
                        canvas { margin-top: 10px; }
                    </style>
                </head>
                <body>
                    <div class="label">
                        ${content}
                    </div>
                    <script>
                        setTimeout(() => { window.print(); window.close(); }, 500);
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in duration-200">
                <div className="bg-gray-800 text-white p-3 flex justify-between items-center">
                    <h3 className="font-bold text-sm flex items-center gap-2">Étiquette Produit</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>
                
                <div className="p-8 flex flex-col items-center justify-center" ref={qrRef}>
                    <QRCodeCanvas value={value} size={180} level={"H"} />
                    <h2 className="text-xl font-bold text-gray-800 mt-4 text-center">{title}</h2>
                    {subtitle && <p className="text-gray-500 text-sm text-center">{subtitle}</p>}
                    <p className="text-xs text-gray-400 mt-1 font-mono">{value}</p>
                    {price && <span className="text-2xl font-bold text-brand-600 mt-2 block">{price.toLocaleString()} F</span>}
                </div>

                <div className="p-4 bg-gray-50 border-t flex justify-center">
                    <button 
                        onClick={handlePrint}
                        className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg transition-transform hover:scale-105"
                    >
                        <Printer size={20} /> Imprimer Étiquette
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- SCANNER COMPONENT ---
interface QRScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (decodedText: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({ isOpen, onClose, onScan }) => {
    const [scanError, setScanError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;

        let scanner: Html5QrcodeScanner | null = null;

        // Small timeout to ensure DOM is ready
        const timeoutId = setTimeout(() => {
            try {
                scanner = new Html5QrcodeScanner(
                    "reader",
                    { 
                        fps: 10, 
                        qrbox: { width: 250, height: 250 },
                        aspectRatio: 1.0
                    },
                    /* verbose= */ false
                );

                scanner.render(
                    (decodedText) => {
                        onScan(decodedText);
                        // Optional: close immediately or let parent handle it
                        // onClose(); 
                        if (scanner) scanner.clear().catch(console.error);
                    },
                    (errorMessage) => {
                        // ignore scan errors, they happen every frame no QR is detected
                    }
                );
            } catch (err) {
                console.error("Scanner init error", err);
                setScanError("Impossible d'initialiser la caméra. Vérifiez les permissions.");
            }
        }, 100);

        return () => {
            clearTimeout(timeoutId);
            if (scanner) {
                scanner.clear().catch(console.error);
            }
        };
    }, [isOpen, onScan]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in duration-200">
                <div className="bg-gray-900 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2"><Camera size={20} /> Scanner un code</h3>
                    <button onClick={onClose}><X size={24} /></button>
                </div>
                
                <div className="p-4 bg-black">
                    <div id="reader" className="w-full bg-white rounded-lg overflow-hidden"></div>
                    {scanError && (
                        <div className="mt-4 p-3 bg-red-100 text-red-700 rounded text-sm flex items-center gap-2">
                            <AlertTriangle size={16} /> {scanError}
                        </div>
                    )}
                </div>

                <div className="p-4 bg-gray-50 text-center text-sm text-gray-500">
                    Placez le QR Code devant la caméra.
                </div>
            </div>
        </div>
    );
};
