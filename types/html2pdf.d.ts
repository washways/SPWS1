declare module 'html2pdf.js' {
    interface Html2PdfOptions {
        margin?: number | number[];
        filename?: string;
        image?: { type: string; quality: number };
        html2canvas?: any;
        jsPDF?: any;
        pagebreak?: { mode: string | string[] };
    }

    interface Html2PdfWorker {
        set(opt: Html2PdfOptions): Html2PdfWorker;
        from(element: HTMLElement): Html2PdfWorker;
        save(): Promise<void>;
    }

    function html2pdf(): Html2PdfWorker;
    export = html2pdf;
}
