function handleUnload(self) {
    const preview = self.parentElement.parentElement;
    const previewId = preview.getAttribute("id");
    preview.innerHTML = "<file-holder></file-holder>";

    if (previewId === 'content-preview') {
        window.assetFile = null;
        window.assetName = '';
    } else if (previewId === 'marker-preview') {
        window.markerImage = null;
    }
};

function handleMarkerUpload(self) {
    const file = self.files[0];

    if (!isValidFile('image', file, "marker-error")) return;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function () {
        const base64Data = reader.result;
        MarkerModule.getFullMarkerImage(base64Data, 0.5, 512, "black")
            .then((fullMarkerImage) => {
                window.markerImage = base64Data;
                const blob = dataURItoBlob(fullMarkerImage);
                const fileURL = URL.createObjectURL(blob);

                const preview = document.getElementById("marker-preview");
                preview.innerHTML = previewImageTemplate(fileURL, file.name);
            }
            );
    };
    self.value = ''; // Reset required for re-upload
};

function handleContentUpload(self) {
    const file = self.files[0];

    if (isValidFile(window.assetType, file, "content-error")) {
        switch (window.assetType) {
            case 'image': {
                handleImageUpload(file);
                break;
            }
            case 'audio': {
                handleAudioUpload(file);
                break;
            }
            case 'video': {
                handleVideoUpload(file);
                break;
            }
            case '3d': {
                handleModelUpload(file);
                break;
            }
        }
    }
    self.value = ''; // Reset required for re-upload
};

function handleImageUpload(file) {
    const fileName = file.name;
    const fileURL = URL.createObjectURL(file);
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onloadend = function () {
        window.assetFile = reader.result.split(",")[1];
        window.assetName = file.type.replace('image/', 'asset.');
    };

    let preview = document.getElementById("content-preview");
    preview.innerHTML = previewImageTemplate(fileURL, fileName);
};

function handleAudioUpload(file) {
    const fileName = file.name;
    const fileURL = URL.createObjectURL(file);
    const reader = new FileReader();

    reader.readAsArrayBuffer(file);
    reader.onloadend = function () {
        //for backend api asset needs only base64 part
        window.assetFile = reader.result;
        window.assetName = file.type.replace('audio/', 'asset.');
    };

    let preview = document.getElementById("content-preview");
    preview.innerHTML = previewAudioTemplate(fileURL, fileName);
};

function handleVideoUpload(file) {
    const fileName = file.name;
    const fileURL = URL.createObjectURL(file);
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onloadend = function () {
        //for backend api asset needs only base64 part
        window.assetFile = reader.result;
        window.assetName = file.type.replace('video/', 'asset.');
    };
    let preview = document.getElementById("content-preview");
    preview.innerHTML = previewVideoTemplate(fileURL, fileName);

    var video = document.querySelector('#video');
    video.addEventListener('canplay', () => {
        if (video.videoWidth > video.videoHeight) {
            video.style.width = '100%';
        } else {
            video.style.height = '100%';
        }

        video.parentElement.style.backgroundColor = 'black';
        document.querySelector('#videoFrame').style.opacity = 1;
    });
};

function handleModelUpload(file) {
    let fileType = file.name.split('.').slice(-1)[0];
    if (fileType === 'glb') {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = function () {
            //for backend api asset needs only base64 part
            window.assetFile = reader.result.split(",")[1];
            let fileName = file.name.split('.');
            window.assetName = 'asset.' + fileName[fileName.length - 1];

            let preview = document.getElementById("content-preview");
            preview.innerHTML = previewModelTemplate(reader.result, file.name);
        };
    } else if (fileType === 'gltf') {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onloadend = function () {
            try {
                let gltf = JSON.parse(reader.result);
                let buffers = gltf.buffers || [];
                let images = gltf.images || [];
                let uri;
                const previewError = document.getElementById("content-error");

                // console.log(gltf.buffers);
                // console.log(gltf.images);
                for (let i = 0; i < buffers.length; i++) {
                    uri = buffers[i].uri;
                    if (uri.indexOf('data:application/octet-stream;base64,') != 0) { // need a related file
                        previewError.innerHTML = '*Please pack all related files to zip file and try again.'

                        return;
                    }
                }
                for (let i = 0; i < images.length; i++) {
                    uri = images[i].uri;
                    if (uri.indexOf('data:application/octet-stream;base64,') != 0) { // need a related file
                        previewError.innerHTML = '*Please pack all related files to zip file and try again.'
                        return;
                    }
                }

            } catch (error) {
                previewError.innerHTML = '*The gltf file is corrupted.'
                return;
            }
            // console.log(reader.result);
        };
    } else if (fileType == 'zip') {
        handleZip(file, (err, result) => {
            if (err) {
                const previewError = document.getElementById("content-error");
                previewError.innerHTML = err === true ? '*Please check the zip file is correct' : err;
                return;
            }
            window.assetFile = result.split(",")[1];
            window.assetName = 'asset.gltf';

            let preview = document.getElementById("content-preview");
            preview.innerHTML = previewModelTemplate(result, file.name);
        })

    }
};

function handleZip(file, cb) {
    const reader = new FileReader();
    reader.readAsArrayBuffer(file);
    reader.onloadend = function () {
        const data = reader.result;
        JSZip.loadAsync(data).then((zip) => {
            for (let i in zip.files) console.log(i);
            for (let i in zip.files) {
                if (/.gltf$/.test(i)) {
                    let prePath = '';
                    let file = i.split('/');
                    file.pop();
                    if (file.length > 0) prePath = file.join('/') + '/';
                    zip.file(i).async('string').then(text => {
                        try {
                            let gltf = JSON.parse(text);
                            let buffers = gltf.buffers || [];
                            let images = gltf.images || [];
                            let uri;
                            let targets = [];

                            // console.log(gltf.buffers);
                            // console.log(gltf.images);
                            for (let i = 0; i < buffers.length; i++) {
                                uri = buffers[i].uri;
                                if (uri.indexOf('data:application/octet-stream;base64,') != 0) { // need a related file
                                    buffers[i].uri = prePath + uri;
                                    targets.push(buffers[i])
                                }
                            }
                            for (let i = 0; i < images.length; i++) {
                                uri = images[i].uri;
                                if (uri.indexOf('data:application/octet-stream;base64,') != 0) { // need a related file
                                    images[i].uri = prePath + uri;
                                    targets.push(images[i])
                                }
                            }
                            extractTargets(gltf, targets, zip, cb);
                        } catch (error) {
                            cb(`*The file [${i}] is corrupted`);
                        }
                    }).catch(error => {
                        console.log(error)
                        cb(true);
                    });
                    return;
                }
            }
            cb('no gltf file in the zip');
        });
    };
};

function extractTargets(gltf, targets, zip, cb) {
    if (targets.length < 1) {
        return cb(false, 'data:application/octet-stream;base64,' + btoa(JSON.stringify(gltf)));
    }
    let one = targets.shift();
    let zipFile = zip.file(one.uri);
    if (!zipFile) return cb(`*Miss the file [${one.uri}] inside the zip file.`);
    // console.log(one.uri);
    zipFile.async('base64').then(base64 => {
        one.uri = 'data:application/octet-stream;base64,' + base64;
        extractTargets(gltf, targets, zip, cb);
    }).catch(err => {
        console.log(err);
        cb(true);
    })
};