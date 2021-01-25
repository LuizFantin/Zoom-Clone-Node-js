const server = require('http').createServer((request,response)=>{
    response.writeHead(204,{
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'OPTIONS, POST, GET',
    })
    response.end('Hey, Jude!')
})

const socketIo = require('socket.io')
const io = socketIo(server, {
    cors: {
        origin: '*',
        credentials: false
    }
})

io.on('connection', socket =>{
    console.log('connection', socket.id)
    socket.on('join-room', (roomId,userId)=>{
        //Add the users to same room
        socket.join(roomId)
        socket.to(roomId).broadcast.emit('user-connected',userId)
        socket.on('disconnect', () => {
            console.log('I am leaving because I am a coward', roomId, userId)
            socket.to(roomId).broadcast.emit('user-disconnected',userId)
        })
    })
})

const startServer = () => {
    const {adress, port} = server.address()
    console.info(`App running at ${adress}:${port}`)
}

server.listen(process.env.PORT || 3000, startServer)