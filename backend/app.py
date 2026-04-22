from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = 'supersecret_kanban_key_2026'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///kanban_v2.db' 
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# ================= MODELS (Section 2 Structure Maintained) =================
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

class Board(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class BoardMember(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    board_id = db.Column(db.Integer, db.ForeignKey('board.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    role = db.Column(db.String(20), default='member') 

class ListModel(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    board_id = db.Column(db.Integer, db.ForeignKey('board.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)

class Task(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    list_id = db.Column(db.Integer, db.ForeignKey('list_model.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)

# ================= AUTH ROUTES =================
@app.route('/auth/register', methods=['POST'])
def register():
    data = request.json
    try:
        hashed_pw = generate_password_hash(data['password'], method='pbkdf2:sha256')
        new_user = User(username=data['username'], email=data['email'], password=hashed_pw)
        db.session.add(new_user)
        db.session.commit()
        return jsonify({"message": "Registered!"}), 201
    except:
        db.session.rollback()
        return jsonify({"error": "User/Email already exists"}), 400

@app.route('/auth/login', methods=['POST'])
def login():
    data = request.json
    user = User.query.filter_by(username=data['username']).first()
    if user and check_password_hash(user.password, data['password']):
        token = jwt.encode({'user_id': user.id, 'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=24)}, app.config['SECRET_KEY'])
        return jsonify({"token": token, "username": user.username, "user_id": user.id})
    return jsonify({"error": "Invalid credentials"}), 401

# ================= BOARD & INVITE ROUTES =================
@app.route('/boards/<int:board_id>', methods=['GET'])
def get_board(board_id):
    board = Board.query.get(board_id)
    if not board: return jsonify({"error": "Not found"}), 404
    lists = ListModel.query.filter_by(board_id=board.id).all()
    tasks = Task.query.filter(Task.list_id.in_([l.id for l in lists])).all() if lists else []
    return jsonify({
        "lists": [{"id": str(l.id), "title": l.title} for l in lists],
        "tasks": [{"id": str(t.id), "list_id": str(t.list_id), "title": t.title} for t in tasks]
    })

@app.route('/boards/<int:board_id>/invite', methods=['POST'])
def invite_member(board_id):
    data = request.json
    user = User.query.filter_by(email=data.get('email')).first()
    if not user: return jsonify({"error": "Not found"}), 404
    role = data.get('role', 'member')
    new_mem = BoardMember(board_id=board_id, user_id=user.id, role=role)
    db.session.add(new_mem)
    db.session.commit()
    return jsonify({"message": f"{user.username} added as {role}"})

# ================= SECTION 3: LIST & TASK ACTIONS (Edit/Delete) =================

@app.route('/lists', methods=['POST'])
def create_list():
    data = request.json
    nl = ListModel(board_id=data['board_id'], title=data['title'])
    db.session.add(nl)
    db.session.commit()
    socketio.emit('board_updated')
    return jsonify({"id": str(nl.id)})

@app.route('/lists/<int:list_id>', methods=['DELETE'])
def delete_list(list_id):
    # Rule: List delete hone se pehle uske saare tasks saaf karne honge
    Task.query.filter_by(list_id=list_id).delete()
    l = ListModel.query.get(list_id)
    if l:
        db.session.delete(l)
        db.session.commit()
        socketio.emit('board_updated')
        return jsonify({"success": True})
    return jsonify({"error": "List not found"}), 404

@app.route('/tasks', methods=['POST'])
def create_task():
    data = request.json
    nt = Task(list_id=int(data['list_id']), title=data['title'])
    db.session.add(nt)
    db.session.commit()
    socketio.emit('board_updated')
    return jsonify({"id": str(nt.id)})

@app.route('/tasks/<int:task_id>', methods=['PATCH'])
def update_task(task_id):
    data = request.json
    t = Task.query.get(task_id)
    if not t: return jsonify({"error": "Not found"}), 404
    if 'list_id' in data: t.list_id = int(data['list_id'])
    if 'title' in data: t.title = data['title']
    db.session.commit()
    return jsonify({"success": True})

@app.route('/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    t = Task.query.get(task_id)
    if t:
        db.session.delete(t)
        db.session.commit()
        socketio.emit('board_updated')
        return jsonify({"success": True})
    return jsonify({"error": "Task not found"}), 404

# ================= REAL-TIME UPDATES =================
@socketio.on('move_task')
def handle_move(data):
    emit('board_updated', broadcast=True)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        if not Board.query.first():
            db.session.add(Board(name="Main Workspace"))
            db.session.commit()
    socketio.run(app, debug=True, port=5000)