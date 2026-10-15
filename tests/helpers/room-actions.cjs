// Narrow capture seam for client tests that exclude the shared controls UI.
// Actual pending, permissions and placement are tested with real RoomControls.
module.exports=function captureRoomActions(){
 let binding;
 return {bindActions(value){binding=value;return {refresh(){}};},get binding(){return binding;}};
};
