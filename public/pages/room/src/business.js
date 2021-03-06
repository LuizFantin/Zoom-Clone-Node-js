class Business{
    constructor({room, media, view, socketBuilder, peerBuilder}){
        this.room = room
        this.media = media
        this.view = view

        this.socketBuilder = socketBuilder
        this.peerBuilder = peerBuilder
            
        this.socket = {}
        this.currentStream = {}
        this.currentPeer = {}

        this.peers = new Map()
        this.userRecordings = new Map()
    }
    
    static initialize(deps){
        const instance = new Business(deps)
        return instance._init()
    }
    
    async _init(){

        this.view.configureRecordButton(this.onRecordPressed.bind(this))
        this.view.configureLeaveButton(this.onLeavePressed.bind(this))
        
        this.currentStream = await this.media.getCamera(true)
        this.socket = this.socketBuilder
        .setOnUserConnected(this.onUserConnected())
        .setOnUserDisconnected(this.onUserDisconnected())
        .build()


        this.currentPeer = await this.peerBuilder
            .setOnError(this.onPeerError())
            .setOnConnectionOpened(this.onPeerConnectionOpened())
            .setOnCallReceived(this.onPeerCallReceived())
            .setOnPeerStreamReceived(this.onPeerStreamReceived())
            .setOnCallError(this.onCallError())
            .setOnCallClose(this.onCallClose())
            .build()

        this.addVideoStream(this.currentPeer.id)
    }

    addVideoStream(userId, stream = this.currentStream){
        const recorderInstance = new Recorder(userId, stream)
        this.userRecordings.set(recorderInstance.filename, recorderInstance)
        if(this.recordingEnabled){
            recorderInstance.startRecording()
        }

        const isCurrentId = userId === this.currentPeer.id
        this.view.renderVideo({
            userId,
            muted: true,
            stream,
            isCurrentId
        })
    }

    onUserConnected = function () {
        return userId => {
            console.log('user connected!', userId)
            this.currentPeer.call(userId, this.currentStream)
        }
    }
    
    onUserDisconnected = function () {
        return userId => {
            console.log('user disconnected!', userId)

            if(this.peers.has(userId)){
                this.peers.get(userId).call.close()
                this.peers.delete(userId)
            }

            this.view.setParticipants(this.peers.size)
            this.stopRecording(userId)
            this.view.removeVideoElement(userId)
        }
    }

    onPeerError = function () {
        return error => {
            console.log('Error no peer!',error)
        }
    }

    onPeerConnectionOpened = function () {
        return (peer) => {
            const id = peer.id
            console.log("Peer!!!", peer)
            this.socket.emit('join-room', this.room, id)
        }
    }

    onPeerCallReceived = function () {
        return call => {
            console.log("Call answer!!!", call)
            call.answer(this.currentStream)
        }
    }

    onPeerStreamReceived = function () {
        return (call, stream) => {
            const callerId = call.peer
            if(this.peers.has(callerId)){
                return
            }
            this.addVideoStream(callerId, stream)
            this.peers.set(callerId, { call })
            
            this.view.setParticipants(this.peers.size)
        }
    }

    onCallError = function () {
        return (call, error) => {
            console.log("Houston we have a problem", error)
            this.view.removeVideoElement(call.peer)
        }
    }

    onCallClose = function () {
        return call => {
            console.log("Call closed!", call.peer)
        }
    }

    onRecordPressed(recordingEnabled) {
        this.recordingEnabled = recordingEnabled
        console.log('pressed!', recordingEnabled)
        for( const [key, value] of this.userRecordings){
            if(this.recordingEnabled){
                value.startRecording()
                continue;
            }
            this.stopRecording(key)
        }

    }

    async stopRecording(userId) {
        const userRecordings = this.userRecordings
        for( const [key, value] of userRecordings){
            const isContextUser = key.includes(userId)
            if(!isContextUser) continue

            const rec = value
            const isRecordingActive = rec.recordingActive
            if(!isRecordingActive) continue

            await rec.stopRecording()
            this.playRecordings(key)

        }
    }

    playRecordings(userId) {
        const user = this.userRecordings.get(userId)
        const videoURLs = user.getAllVideosURLs()
        videoURLs.map(url => {
            this.view.renderVideo({url, userId})
        })
    }

    onLeavePressed() {
        console.log('😒 meteu o pé!')
        this.userRecordings.forEach((value, key) => value.download())
    }
}