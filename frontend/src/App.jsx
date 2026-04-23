import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';

const socket = io('http://127.0.0.1:5000');


const colors = ['#e3f2fd', '#f1f8e9', '#fffde7', '#fce4ec', '#f3e5f5'];

function App() {
  const [view, setView] = useState('login'); 
  const [user, setUser] = useState(localStorage.getItem('username') || null);
  const [currentBoard, setCurrentBoard] = useState(JSON.parse(localStorage.getItem('lastBoard')) || null);
  const [data, setData] = useState({ lists: [], tasks: [] });
  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [newBoardName, setNewBoardName] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState({});
  const [newListTitle, setNewListTitle] = useState("");

  useEffect(() => {
    if (user && currentBoard) { setView('kanban'); fetchBoardData(currentBoard.id); }
    else if (user) { setView('boards'); }
  }, []);

  const fetchBoardData = (boardId) => {
    axios.get(`http://127.0.0.1:5000/boards/${boardId}`)
      .then(res => setData({ lists: res.data.lists, tasks: res.data.tasks }))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    if (currentBoard) {
      fetchBoardData(currentBoard.id);
      socket.on('board_updated', () => fetchBoardData(currentBoard.id));
    }
    return () => socket.off('board_updated');
  }, [currentBoard]);

  const handleAuth = async (type) => {
    try {
      const url = type === 'login' ? '/auth/login' : '/auth/register';
      const res = await axios.post(`http://127.0.0.1:5000${url}`, authForm);
      if (type === 'login') {
        localStorage.setItem('username', res.data.username);
        setUser(res.data.username);
        setView('boards');
      } else { alert("Registered! Login karein."); }
    } catch (err) { alert("Error!"); }
  };

  const handleLogout = () => { localStorage.clear(); window.location.reload(); };

  const handleEnterBoard = (boardObj) => {
    const boardWithDate = { ...boardObj, created_at: boardObj.created_at || new Date().toISOString() };
    localStorage.setItem('lastBoard', JSON.stringify(boardWithDate));
    setCurrentBoard(boardWithDate);
    setView('kanban');
  };

  const handleAddList = async () => {
    if (!newListTitle) return;
    await axios.post('http://127.0.0.1:5000/lists', { board_id: currentBoard.id, title: newListTitle });
    setNewListTitle("");
  };

  const handleDeleteList = async (id) => { if(window.confirm("Delete List?")) await axios.delete(`http://127.0.0.1:5000/lists/${id}`); };
  const handleAddTask = async (id) => {
    if (!newTaskTitle[id]) return;
    await axios.post('http://127.0.0.1:5000/tasks', { list_id: id, title: newTaskTitle[id] });
    setNewTaskTitle({ ...newTaskTitle, [id]: "" });
  };
  const handleDeleteTask = async (id) => { await axios.delete(`http://127.0.0.1:5000/tasks/${id}`); };

  const onDragEnd = async (result) => {
    const { destination, draggableId } = result;
    
    
    if (!destination) return;

    try {
      // 1. Backend ko update karo
      await axios.patch(`http://127.0.0.1:5000/tasks/${draggableId}`, { 
        list_id: destination.droppableId 
      });

      
      socket.emit('move_task', { boardId: currentBoard.id });

      
      fetchBoardData(currentBoard.id);
      
    } catch (err) {
      console.error("Drag error:", err);
      alert("Move nahi ho paya, shayad network issue hai!");
    }
  };

  if (view === 'login') return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'Segoe UI' }}>
      <h1 style={{color: '#007bff'}}>Synergy Kanban 🚀</h1>
      <div style={{background: '#fff', padding: '30px', display: 'inline-block', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'}}>
        <input placeholder="Username" onChange={e => setAuthForm({...authForm, username: e.target.value})} style={{display: 'block', padding: '12px', margin: '10px auto', width: '250px', borderRadius: '6px', border: '1px solid #ddd'}} />
        <input type="password" placeholder="Password" onChange={e => setAuthForm({...authForm, password: e.target.value})} style={{display: 'block', padding: '12px', margin: '10px auto', width: '250px', borderRadius: '6px', border: '1px solid #ddd'}} />
        <button onClick={() => handleAuth('login')} style={{padding: '12px 30px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold'}}>Login</button>
      </div>
    </div>
  );

  if (view === 'boards') return (
    <div style={{ textAlign: 'center', marginTop: '80px', fontFamily: 'Segoe UI' }}>
      <h2>Welcome Back, <span style={{color: '#007bff'}}>{user}</span>!</h2>
      <div onClick={() => handleEnterBoard({ id: 1, name: 'Main Project' })} 
           style={{ background: 'linear-gradient(135deg, #007bff, #0056b3)', color: '#fff', padding: '40px', cursor: 'pointer', borderRadius: '15px', display: 'inline-block', marginTop: '30px', boxShadow: '0 8px 20px rgba(0,123,255,0.3)', transition: 'transform 0.2s' }}>
        <h3 style={{margin: 0}}>📁 Main Project Board</h3>
        <p style={{fontSize: '12px', opacity: 0.8}}>Click to enter workspace</p>
      </div>
      <br/><button onClick={handleLogout} style={{marginTop: '40px', color: 'red', border: '1px solid red', background: 'none', padding: '8px 20px', borderRadius: '20px', cursor: 'pointer'}}>Logout</button>
    </div>
  );

  return (
    <div style={{ padding: '25px', fontFamily: 'Segoe UI', backgroundColor: '#f4f7f9', minHeight: '100vh' }}>
      
      {/* HEADER SECTION - Glassmorphism Look */}
      <div style={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(10px)', padding: '20px', borderRadius: '12px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
        <div>
          <button onClick={() => setView('boards')} style={{background: '#eee', border: 'none', padding: '8px 15px', borderRadius: '6px', cursor: 'pointer'}}>← Boards</button>
          <strong style={{marginLeft: '20px', fontSize: '24px', color: '#172b4d'}}>{currentBoard.name}</strong>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
            <div style={{textAlign: 'right', fontSize: '12px', color: '#666'}}>
                <div>Owner: <b>{user}</b></div>
                <div>Created: {new Date(currentBoard.created_at).toLocaleDateString()}</div>
            </div>
            <button onClick={() => alert("Invite link copied!")} style={{background: '#ffc107', border: 'none', padding: '10px 15px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'}}>+ Invite</button>
            <button onClick={handleLogout} style={{background: '#ff4d4d', color: '#fff', border: 'none', padding: '10px 15px', borderRadius: '6px', cursor: 'pointer'}}>Logout</button>
        </div>
      </div>

      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <input value={newListTitle} onChange={(e) => setNewListTitle(e.target.value)} placeholder="Add a new column..." style={{ padding: '12px', width: '300px', borderRadius: '8px 0 0 8px', border: '1px solid #ddd', outline: 'none' }} />
        <button onClick={handleAddList} style={{padding: '12px 25px', background: '#007bff', color: '#fff', border: 'none', borderRadius: '0 8px 8px 0', cursor: 'pointer', fontWeight: 'bold'}}>+ Add List</button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div style={{ display: 'flex', gap: '25px', overflowX: 'auto', paddingBottom: '20px' }}>
          {data.lists.length === 0 && <p style={{margin: 'auto', color: '#999', fontSize: '18px'}}>Board is empty. Add a list to start! ✨</p>}
          
          {data.lists.map((list, listIdx) => (
            <div key={list.id} style={{ background: '#ebedf0', padding: '15px', borderRadius: '10px', minWidth: '300px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#333' }}>{list.title}</h3>
                <button onClick={() => handleDeleteList(list.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', opacity: 0.5 }}>🗑️</button>
              </div>
              
              <Droppable droppableId={String(list.id)}>
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} style={{ minHeight: '100px' }}>
                    {data.tasks.filter(t => String(t.list_id) === String(list.id)).map((task, index) => (
                      <Draggable key={task.id} draggableId={String(task.id)} index={index}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} 
                               style={{ 
                                 padding: '15px', marginBottom: '12px', 
                                 backgroundColor: colors[index % colors.length], // Color Tadka!
                                 borderRadius: '8px', display: 'flex', justifyContent: 'space-between', 
                                 boxShadow: snapshot.isDragging ? '0 10px 20px rgba(0,0,0,0.15)' : '0 2px 4px rgba(0,0,0,0.05)',
                                 transform: snapshot.isDragging ? 'rotate(3deg)' : 'none', // Tilt Tadka!
                                 borderLeft: '5px solid #007bff',
                                 ...provided.draggableProps.style 
                               }}>
                            <span style={{fontWeight: '500'}}>{task.title}</span>
                            <button onClick={() => handleDeleteTask(task.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#999' }}>✕</button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
              <div style={{marginTop: '15px', display: 'flex', gap: '5px'}}>
                <input placeholder="Type task..." value={newTaskTitle[list.id] || ""} onChange={e => setNewTaskTitle({...newTaskTitle, [list.id]: e.target.value})} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }} />
                <button onClick={() => handleAddTask(list.id)} style={{ padding: '10px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold' }}>Add</button>
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

export default App;