class Canvas {
    constructor() {
        this.element = document.getElementById('canvas');
        this.thumbnailElem = document.getElementById('thumbnail');
        this.thumbnailElem.getContext('2d').willReadFrequently = true;

        this.element.addEventListener('mousedown', e => this.startDrawing(e.offsetX, e.offsetY));
        this.element.addEventListener('mousemove', e => this.stroke(e.offsetX, e.offsetY));
        this.element.addEventListener('mouseup', e => this.endDrawing());
        this.element.addEventListener('mouseout', e => this.endDrawing());

        this.prex = 0;
        this.prey = 0;
        this.downFlag = false;
    }

    clear() {
        this.element.getContext('2d').clearRect(0, 0, this.element.width, this.element.height);
        this.thumbnailElem.getContext('2d').clearRect(0, 0, this.thumbnailElem.width, this.thumbnailElem.height);        
    }

    startDrawing(x, y) {
        this.downFlag = true;
        this.prex = x;
        this.prey = y;
    }

    stroke(x, y) {
        if (!this.downFlag) { return; }
        this.drawLine(this.prex, this.prey, x, y);
        this.prex = x;
        this.prey = y;
    }

    endDrawing() {
        this.downFlag = false;
        this.drawThumbnail();
    }

    drawThumbnail() {
        this.thumbnailElem.getContext('2d').drawImage(
            this.element, 
            0, 0, this.element.width, this.element.height, 
            0, 0, this.thumbnailElem.width, this.thumbnailElem.height
        );
    }

    drawLine(x1, y1, x2, y2) {
        const context = this.element.getContext('2d');
        context.lineCap = 'round';
        context.lineWidth = 15;
        context.strokeStyle = '#FFFFFF';
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(x2, y2);
        context.stroke();
    }

    getImage() {
        const elem = this.element;
        return elem.getContext('2d').getImageData(0, 0, elem.width, elem.height);
    }

    getThumbnailImage() {
        const elem = this.thumbnailElem;
        return elem.getContext('2d').getImageData(0, 0, elem.width, elem.height);
    }
}