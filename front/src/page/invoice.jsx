import React, { useState, useEffect } from "react";
import { useNotificationStore } from "../store/notificationStore.js";
import "../style/invoice.css";
import invoice from "../assets/oblozhka.png"
export default function Invoice() {
    const {
        users,
        accessRoles,
        isLoading,
        error,
        fetchAllUsers,
        fetchAllAccessRoles,
        sendNotification,
        clearError,
    } = useNotificationStore();

    const [allUsers, setAllUsers] = useState(false);
    const [recipientType, setRecipientType] = useState("ALL");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [userSearchTerm, setUserSearchTerm] = useState("");
    const [roleSearchTerm, setRoleSearchTerm] = useState("");

    // Загрузка данных при монтировании компонента
    useEffect(() => {
        fetchAllUsers();
        fetchAllAccessRoles();
        return () => clearError();
    }, [fetchAllUsers, fetchAllAccessRoles, clearError]);

    // Фильтрация пользователей по поиску
    const filteredUsers = users.filter(user => {
        const fullName = `${user.firstName || ""} ${user.lastName || ""}`.toLowerCase();
        return fullName.includes(userSearchTerm.toLowerCase()) ||
            (user.email || "").toLowerCase().includes(userSearchTerm.toLowerCase());
    });

    // Фильтрация ролей по поиску
    const filteredRoles = accessRoles.filter(role =>
        (role.title || "").toLowerCase().includes(roleSearchTerm.toLowerCase())
    );

    // Переключение выбора пользователя
    const toggleUser = (userId) => {
        setSelectedUsers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    // Переключение выбора роли
    const toggleRole = (roleId) => {
        setSelectedRoles(prev =>
            prev.includes(roleId)
                ? prev.filter(id => id !== roleId)
                : [...prev, roleId]
        );
    };

    // Отправка уведомления
    const handleSendNotification = async () => {
        if (!title.trim()) {
            alert("Заголовок обязателен");
            return;
        }

        if (!description.trim()) {
            alert("Описание обязательно");
            return;
        }

        try {
            let payload = {
                title: title.trim(),
                message: description.trim(),
            };

            if (allUsers || recipientType === "ALL") {
                payload.recipientType = "SPECIFIC_USERS";
                payload.recipientIds = users.map(u => u.id);
            } else if (recipientType === "SPECIFIC_USERS" && selectedUsers.length > 0) {
                payload.recipientType = "SPECIFIC_USERS";
                payload.recipientIds = selectedUsers;
            } else if (recipientType === "BY_ROLE" && selectedRoles.length > 0) {
                // Отправляем уведомления для каждой выбранной роли
                for (const roleId of selectedRoles) {
                    await sendNotification({
                        title: title.trim(),
                        message: description.trim(),
                        recipientType: "BY_ACCESS_ROLE",
                        accessRoleId: roleId,
                    });
                }
                alert("Уведомление успешно отправлено!");
                resetForm();
                return;
            } else {
                alert("Выберите получателей");
                return;
            }

            await sendNotification(payload);
            alert("Уведомление успешно отправлено!");
            resetForm();
        } catch (err) {
            alert(error || "Ошибка отправки уведомления");
        }
    };

    // Сброс формы
    const resetForm = () => {
        setTitle("");
        setDescription("");
        setSelectedUsers([]);
        setSelectedRoles([]);
        setAllUsers(false);
        setRecipientType("ALL");
        setUserSearchTerm("");
        setRoleSearchTerm("");
    };

    return (
        <div className="inv-root">
            <div className="inv-left">
                <h2 className="inv-title">Создать рассылку</h2>
                <div className="inv-imgpicker">
                    <div className="inv-imgpicker-area">
                        <span className="inv-img-camera" role="img" aria-label="camera">
                            <img src={invoice} className="invoic_img" alt="" />
                        </span>
                    </div>
                </div>

                <label>Заголовок</label>
                <input
                    type="text"
                    placeholder="Заголовок"
                    className="inv-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                <label>Кто получит?</label>
                <select
                    className="inv-input"
                    value={recipientType}
                    onChange={(e) => {
                        setRecipientType(e.target.value);
                        setAllUsers(e.target.value === "ALL");
                    }}
                >
                    <option value="ALL">Все пользователи</option>
                    <option value="SPECIFIC_USERS">Выбранные пользователи</option>
                    <option value="BY_ROLE">По ролям доступа</option>
                </select>

                <label>Описание</label>
                <textarea
                    className="inv-input"
                    placeholder="Описание"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                {error && <div className="inv-error">{error}</div>}

                <div className="inv-btns">
                    <button className="inv-btn white" onClick={resetForm}>Очистить</button>
                    <button
                        className="inv-btn primary"
                        onClick={handleSendNotification}
                        disabled={isLoading}
                    >
                        {isLoading ? "Отправка..." : "Отправить рассылку"}
                    </button>
                </div>
            </div>
            <div className="inv-sep" />
            <div className="inv-right">
                <div className="inv-block-title">Кто получит?</div>
                <div className="inv-allusers">
                    <label>
                        <input
                            type="checkbox"
                            checked={allUsers}
                            onChange={(e) => {
                                setAllUsers(e.target.checked);
                                if (e.target.checked) {
                                    setRecipientType("ALL");
                                    setSelectedUsers([]);
                                    setSelectedRoles([]);
                                }
                            }}
                        />
                        Все пользователи
                    </label>
                </div>

                {recipientType === "SPECIFIC_USERS" && !allUsers && (
                    <div className="inv-subblock">
                        <div className="inv-subtitle">Определенные пользователи</div>
                        <div className="inv-search">
                            <input
                                type="text"
                                placeholder="Поиск..."
                                className="inv-search-input"
                                value={userSearchTerm}
                                onChange={(e) => setUserSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="inv-people-list">
                            {isLoading ? (
                                <div>Загрузка пользователей...</div>
                            ) : filteredUsers.length === 0 ? (
                                <div>Пользователи не найдены</div>
                            ) : (
                                filteredUsers.map(user => (
                                    <label key={user.id} className="inv-user">
                                        <input
                                            type="checkbox"
                                            checked={selectedUsers.includes(user.id)}
                                            onChange={() => toggleUser(user.id)}
                                        />
                                        <img
                                            src={user.avatar || `https://ui-avatars.com/api/?name=${user.firstName}+${user.lastName}`}
                                            alt="avatar"
                                            className="inv-avatar"
                                        />
                                        <span>{`${user.firstName || ""} ${user.lastName || ""}`}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {recipientType === "BY_ROLE" && !allUsers && (
                    <div className="inv-subblock">
                        <div className="inv-subtitle">По ролям доступа</div>
                        <div className="inv-search">
                            <input
                                type="text"
                                placeholder="Поиск..."
                                className="inv-search-input"
                                value={roleSearchTerm}
                                onChange={(e) => setRoleSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="inv-roles-list">
                            {isLoading ? (
                                <div>Загрузка ролей...</div>
                            ) : filteredRoles.length === 0 ? (
                                <div>Роли не найдены</div>
                            ) : (
                                filteredRoles.map(role => (
                                    <label key={role.id} className="inv-role">
                                        <input
                                            type="checkbox"
                                            checked={selectedRoles.includes(role.id)}
                                            onChange={() => toggleRole(role.id)}
                                        />
                                        <span>{role.title}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
